import requests
import geoip2.database
import geoip2.errors
from typing import Dict, List, Optional
from datetime import datetime
import os

class GeoIntelligence:
    def __init__(self):
        self.geo_db_path = "GeoLite2-Country.mmdb"
        self.geo_reader = None
        self._load_geo_db()
        
        # Currency mapping by country code
        self.country_currency = {
            'US': 'USD', 'GB': 'GBP', 'NG': 'NGN', 'GH': 'GHS', 'KE': 'KES',
            'ZA': 'ZAR', 'IN': 'INR', 'PK': 'PKR', 'BD': 'BDT', 'PH': 'PHP',
            'ID': 'IDR', 'MY': 'MYR', 'SG': 'SGD', 'AE': 'AED', 'SA': 'SAR',
            'DE': 'EUR', 'FR': 'EUR', 'ES': 'EUR', 'IT': 'EUR', 'NL': 'EUR',
            'CA': 'CAD', 'AU': 'AUD', 'JP': 'JPY', 'CN': 'CNY', 'BR': 'BRL',
            'MX': 'MXN', 'AR': 'ARS', 'EG': 'EGP', 'TR': 'TRY', 'RU': 'RUB'
            # Add more as needed
        }
        
        # Cache exchange rates (refresh every hour)
        self.exchange_rates = {}
        self.last_rate_update = None
    
    def _load_geo_db(self):
        """Load MaxMind GeoIP database"""
        if os.path.exists(self.geo_db_path):
            self.geo_reader = geoip2.database.Reader(self.geo_db_path)
            print("✅ GeoIP database loaded")
        else:
            print("⚠️ GeoIP database not found. Download GeoLite2-Country.mmdb from MaxMind")
    
    def get_location_from_ip(self, ip_address: str) -> Dict:
        """
        Get country, city, coordinates from IP address
        Returns country code, currency, timezone
        """
        if not self.geo_reader:
            return {
                'country_code': 'US',
                'country_name': 'United States',
                'currency': 'USD',
                'is_vpn': False,
                'error': 'GeoIP database not loaded'
            }
        
        try:
            # Skip private/local IPs
            if ip_address.startswith(('192.168.', '10.', '172.16.', '127.', 'localhost')):
                return {
                    'country_code': 'LOCAL',
                    'country_name': 'Local Network',
                    'currency': 'USD',
                    'is_local': True
                }
            
            response = self.geo_reader.country(ip_address)
            
            country_code = response.country.iso_code or 'US'
            country_name = response.country.name or 'Unknown'
            
            # Check if using VPN/Proxy (basic check)
            is_vpn = self._detect_vpn(ip_address)
            
            return {
                'country_code': country_code,
                'country_name': country_name,
                'currency': self.country_currency.get(country_code, 'USD'),
                'is_vpn': is_vpn,
                'continent': response.continent.code if response.continent else None
            }
            
        except geoip2.errors.AddressNotFoundError:
            return {
                'country_code': 'UNKNOWN',
                'country_name': 'Unknown',
                'currency': 'USD',
                'is_vpn': True,  # Unknown IPs often VPNs
                'error': 'IP not found in database'
            }
    
    def get_exchange_rate(self, from_currency: str, to_currency: str = 'USD') -> float:
        """
        Get real-time exchange rate
        Falls back to static rates if API fails
        """
        # Check cache (refresh every hour)
        if (self.last_rate_update and 
            (datetime.now() - self.last_rate_update).seconds < 3600 and
            self.exchange_rates):
            return self.exchange_rates.get(f"{from_currency}_{to_currency}", 1.0)
        
        try:
            # Free API - no key needed for basic use
            url = f"https://api.exchangerate-api.com/v4/latest/{from_currency}"
            response = requests.get(url, timeout=10)
            data = response.json()
            
            if 'rates' in data:
                self.exchange_rates = {
                    f"{from_currency}_{curr}": rate 
                    for curr, rate in data['rates'].items()
                }
                self.last_rate_update = datetime.now()
                return data['rates'].get(to_currency, 1.0)
                
        except Exception as e:
            print(f"⚠️ Exchange rate API failed: {e}")
            # Fallback static rates (approximate, update manually)
            fallback_rates = {
                'NGN_USD': 0.00065, 'GHS_USD': 0.065, 'KES_USD': 0.0077,
                'INR_USD': 0.012, 'GBP_USD': 1.27, 'EUR_USD': 1.09,
                'USD_NGN': 1530, 'USD_GHS': 15.4, 'USD_KES': 130
            }
            return fallback_rates.get(f"{from_currency}_{to_currency}", 1.0)
    
    def convert_currency(self, amount: float, from_curr: str, to_curr: str) -> Dict:
        """Convert amount between currencies with real-time rate"""
        rate = self.get_exchange_rate(from_curr, to_curr)
        converted = amount * rate
        
        return {
            'original_amount': amount,
            'original_currency': from_curr,
            'converted_amount': round(converted, 2),
            'converted_currency': to_curr,
            'exchange_rate': rate,
            'last_updated': self.last_rate_update.isoformat() if self.last_rate_update else 'static'
        }
    
    def _detect_vpn(self, ip_address: str) -> bool:
        """Basic VPN detection (can be enhanced with commercial API)"""
        # Known VPN ranges (simplified - use IPQualityScore for production)
        vpn_indicators = ['104.16.', '104.17.', '172.67.', '162.158.']  # Cloudflare often VPN
        return any(ip_address.startswith(prefix) for prefix in vpn_indicators)
    
    def analyze_ip_risk(self, ip_address: str, user_id: str, known_ips: List[str]) -> Dict:
        """
        Comprehensive IP risk analysis
        """
        location = self.get_location_from_ip(ip_address)
        
        risk_flags = []
        risk_score = 0.0
        
        # VPN check
        if location.get('is_vpn'):
            risk_flags.append("VPN_DETECTED")
            risk_score += 0.3
        
        # New IP for this user
        if ip_address not in known_ips:
            risk_flags.append("NEW_IP_ADDRESS")
            risk_score += 0.2
        
        # High-risk countries (adjust based on your fraud data)
        high_risk_countries = ['XX', 'YY']  # Add countries with high fraud rates
        if location.get('country_code') in high_risk_countries:
            risk_flags.append("HIGH_RISK_GEOGRAPHY")
            risk_score += 0.4
        
        return {
            'ip': ip_address,
            'location': location,
            'risk_score': min(risk_score, 1.0),
            'flags': risk_flags,
            'recommendation': 'allow' if risk_score < 0.3 else 'monitor' if risk_score < 0.6 else 'challenge'
        }

# Singleton
geo_intel = GeoIntelligence()