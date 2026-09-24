from typing import Dict, List, Set
from datetime import datetime, timedelta
from collections import defaultdict
import hashlib

class NetworkGuard:
    """
    Prevents duplicate logins and multi-account abuse
    """
    def __init__(self):
        # In production, use Redis. For localhost, in-memory is fine.
        # Structure: {ip: {'accounts': set(), 'sessions': {user_id: last_active}, 'first_seen': datetime}}
        self.ip_registry = defaultdict(lambda: {
            'accounts': set(),
            'sessions': {},
            'first_seen': datetime.now(),
            'suspicious_activity': []
        })
        
        # Reverse lookup: {user_id: set(ip)}
        self.user_ips = defaultdict(set)
        
        self.MAX_ACCOUNTS_PER_IP = 2  # Your requirement: max 2 accounts
        self.SESSION_TIMEOUT_MINUTES = 30
    
    def register_login(self, user_id: str, ip_address: str, device_fingerprint: str = None) -> Dict:
        """
        Call this on every login/signup
        Returns risk assessment and enforcement actions
        """
        now = datetime.now()
        ip_data = self.ip_registry[ip_address]
        
        # Check for duplicate active session (same IP, same user, different device)
        active_sessions = self._get_active_sessions(ip_address)
        duplicate_login = user_id in active_sessions
        
        # Check account limit for this IP
        is_new_account_for_ip = user_id not in ip_data['accounts']
        current_accounts = len(ip_data['accounts'])
        
        account_limit_exceeded = False
        if is_new_account_for_ip and current_accounts >= self.MAX_ACCOUNTS_PER_IP:
            account_limit_exceeded = True
        
        # Update registries
        ip_data['accounts'].add(user_id)
        ip_data['sessions'][user_id] = {
            'login_time': now,
            'last_active': now,
            'device': device_fingerprint or 'unknown'
        }
        self.user_ips[user_id].add(ip_address)
        
        # Build response
        flags = []
        actions = []
        
        if duplicate_login:
            flags.append("DUPLICATE_ACTIVE_SESSION")
            actions.append("notify_user")  # "You logged in from another device"
        
        if account_limit_exceeded:
            flags.append(f"ACCOUNT_LIMIT_EXCEEDED_{current_accounts + 1}_ACCOUNTS")
            actions.append("flag_for_review")
            actions.append("require_phone_verification")  # Extra step
        
        # Calculate risk
        risk_score = 0.0
        if duplicate_login:
            risk_score += 0.3
        if account_limit_exceeded:
            risk_score += 0.6  # Serious violation
        if len(ip_data['accounts']) > self.MAX_ACCOUNTS_PER_IP:
            risk_score += 0.2
        
        return {
            'allowed': not account_limit_exceeded,  # Block 3rd+ account
            'risk_score': min(risk_score, 1.0),
            'flags': flags,
            'actions': actions,
            'current_accounts_on_ip': len(ip_data['accounts']),
            'max_allowed': self.MAX_ACCOUNTS_PER_IP,
            'message': self._build_message(flags, current_accounts)
        }
    
    def check_account_limit(self, ip_address: str, new_user_id: str) -> Dict:
        """
        Specifically for signup - enforce 2 account max per IP
        """
        ip_data = self.ip_registry[ip_address]
        current_count = len(ip_data['accounts'])
        
        if new_user_id in ip_data['accounts']:
            # Existing user, fine
            return {'allowed': True, 'reason': 'existing_account'}
        
        if current_count >= self.MAX_ACCOUNTS_PER_IP:
            return {
                'allowed': False,
                'reason': 'account_limit_reached',
                'current_accounts': current_count,
                'max_allowed': self.MAX_ACCOUNTS_PER_IP,
                'existing_accounts': list(ip_data['accounts']),  # For investigation
                'suggestion': 'Use phone verification to unlock additional accounts'
            }
        
        return {
            'allowed': True,
            'remaining_slots': self.MAX_ACCOUNTS_PER_IP - current_count - 1
        }
    
    def get_ip_analysis(self, ip_address: str) -> Dict:
        """Admin view: what accounts are on this IP?"""
        ip_data = self.ip_registry[ip_address]
        
        return {
            'ip': ip_address,
            'total_accounts': len(ip_data['accounts']),
            'account_ids': list(ip_data['accounts']),
            'first_seen': ip_data['first_seen'].isoformat(),
            'active_sessions': len(self._get_active_sessions(ip_address)),
            'suspicious_activity': ip_data['suspicious_activity'][-10:]  # Last 10 events
        }
    
    def _get_active_sessions(self, ip_address: str) -> Dict:
        """Get currently active sessions on this IP"""
        ip_data = self.ip_registry[ip_address]
        now = datetime.now()
        active = {}
        
        for user_id, session in ip_data['sessions'].items():
            if now - session['last_active'] < timedelta(minutes=self.SESSION_TIMEOUT_MINUTES):
                active[user_id] = session
        
        return active
    
    def _build_message(self, flags: List[str], account_count: int) -> str:
        if "ACCOUNT_LIMIT_EXCEEDED" in str(flags):
            return f"Maximum {self.MAX_ACCOUNTS_PER_IP} accounts allowed per location. Additional verification required."
        elif "DUPLICATE_ACTIVE_SESSION" in flags:
            return "You are already logged in on another device. Previous session will be logged out."
        return "Login successful"

# Singleton
network_guard = NetworkGuard()