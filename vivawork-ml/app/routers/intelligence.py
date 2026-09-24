from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.database import get_db, ReviewCase
from app.models.geo_intel import geo_intel
from app.models.network_guard import network_guard
from pydantic import BaseModel
from typing import List, Optional
import json
from datetime import datetime

router = APIRouter()

class LoginEvent(BaseModel):
    user_id: str
    ip_address: str
    device_fingerprint: Optional[str] = None
    user_agent: Optional[str] = None

class SignupCheck(BaseModel):
    ip_address: str
    proposed_user_id: str

class CurrencyConversion(BaseModel):
    amount: float
    from_currency: str
    to_currency: Optional[str] = "USD"

@router.post("/login-check")
async def check_login(event: LoginEvent, request: Request, db: Session = Depends(get_db)):
    """
    Call this on EVERY login/signup
    Returns geo info + duplicate detection + account limits
    """
    # Get real IP (handle proxies)
    client_ip = event.ip_address or request.client.host
    
    # 1. Geo Intelligence
    geo_data = geo_intel.get_location_from_ip(client_ip)
    
    # 2. Network Guard (duplicates + account limits)
    network_check = network_guard.register_login(
        user_id=event.user_id,
        ip_address=client_ip,
        device_fingerprint=event.device_fingerprint
    )
    
    # 3. Create review case if flagged
    if network_check['risk_score'] > 0.5 or not network_check['allowed']:
        case = ReviewCase(
            case_type="network_security",
            user_id=event.user_id,
            risk_score=network_check['risk_score'],
            ai_reasoning=f"IP: {client_ip}, Flags: {network_check['flags']}",
            evidence=json.dumps({
                'ip': client_ip,
                'geo': geo_data,
                'accounts_on_ip': network_check.get('current_accounts_on_ip'),
                'flags': network_check['flags']
            }),
            status="pending"
        )
        db.add(case)
        db.commit()
        
        network_check['review_case_id'] = case.id
    
    # 4. Get currency info for this user
    local_currency = geo_data.get('currency', 'USD')
    
    return {
        'login_allowed': network_check['allowed'],
        'geo': geo_data,
        'currency': {
            'local': local_currency,
            'exchange_rate_to_usd': geo_intel.get_exchange_rate(local_currency, 'USD')
        },
        'security': network_check,
        'timestamp': datetime.now().isoformat()
    }

@router.post("/signup-check")
async def check_signup(check: SignupCheck, db: Session = Depends(get_db)):
    """
    Call BEFORE creating account
    Enforces 2-account max per IP
    """
    result = network_guard.check_account_limit(check.ip_address, check.proposed_user_id)
    
    if not result['allowed']:
        # Auto-flag for human review
        case = ReviewCase(
            case_type="multi_account_attempt",
            user_id=check.proposed_user_id,
            risk_score=0.8,
            ai_reasoning=f"Attempted to create account #{result.get('current_accounts', 0) + 1} on IP with existing accounts",
            evidence=json.dumps({
                'ip': check.ip_address,
                'existing_accounts': result.get('existing_accounts', []),
                'attempted_new_account': check.proposed_user_id
            }),
            status="pending"
        )
        db.add(case)
        db.commit()
        
        result['review_case_id'] = case.id
    
    return result

@router.get("/ip-analysis/{ip_address}")
async def analyze_ip(ip_address: str):
    """Admin endpoint: See all accounts on an IP"""
    return network_guard.get_ip_analysis(ip_address)

@router.post("/currency/convert")
async def convert_currency(conversion: CurrencyConversion):
    """
    Real-time currency conversion for withdrawals
    """
    result = geo_intel.convert_currency(
        conversion.amount,
        conversion.from_currency,
        conversion.to_currency
    )
    return result

@router.get("/currency/rates/{base_currency}")
async def get_rates(base_currency: str):
    """Get current exchange rates"""
    rates = {}
    for curr in ['USD', 'NGN', 'GHS', 'GBP', 'EUR', 'KES', 'INR']:
        if curr != base_currency:
            rates[curr] = geo_intel.get_exchange_rate(base_currency, curr)
    
    return {
        'base': base_currency,
        'rates': rates,
        'last_updated': geo_intel.last_rate_update.isoformat() if geo_intel.last_rate_update else 'static'
    }