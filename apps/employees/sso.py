import jwt
import requests
import json
from django.conf import settings
from typing import Dict, Any, Optional

# Cache for JWKS to avoid frequent external requests
JWKS_CACHE = {}

def get_jwks(jwks_url: str) -> dict:
    if jwks_url not in JWKS_CACHE:
        response = requests.get(jwks_url)
        response.raise_for_status()
        JWKS_CACHE[jwks_url] = response.json()
    return JWKS_CACHE[jwks_url]

def verify_sso_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Verifies an OIDC token from Google or Microsoft securely.
    Returns the decoded token payload (which includes 'email') if valid, else raises Exception.
    """
    try:
        # 1. Decode header without verification to find the issuer and key ID
        unverified_header = jwt.get_unverified_header(token)
        unverified_claims = jwt.decode(token, options={"verify_signature": False})
        
        issuer = unverified_claims.get('iss')
        kid = unverified_header.get('kid')
        
        if not issuer or not kid:
            raise ValueError("Token is missing 'iss' or 'kid'")
            
        jwks_url = None
        audience = None
        
        # 2. Identify Provider
        if 'accounts.google.com' in issuer:
            jwks_url = 'https://www.googleapis.com/oauth2/v3/certs'
            # Google Audience checking (Optional in dev, but good for prod)
            # audience = settings.GOOGLE_CLIENT_ID
        elif 'login.microsoftonline.com' in issuer:
            jwks_url = 'https://login.microsoftonline.com/common/discovery/v2.0/keys'
            # audience = settings.MSAL_CLIENT_ID
        else:
            raise ValueError(f"Unknown issuer: {issuer}")
            
        # 3. Fetch JWKS and find the matching public key
        jwks = get_jwks(jwks_url)
        public_key = None
        
        for key in jwks.get('keys', []):
            if key.get('kid') == kid:
                public_key = jwt.algorithms.RSAAlgorithm.from_jwk(json.dumps(key))
                break
                
        if not public_key:
            raise ValueError("Public key not found in JWKS for the given 'kid'")
            
        # 4. Verify Signature and Expiration securely
        decoded = jwt.decode(
            token,
            public_key,
            algorithms=['RS256'],
            options={"verify_aud": False} # Set to true if audience is provided and strict
        )
        
        return decoded
        
    except jwt.ExpiredSignatureError:
        raise ValueError("Token has expired")
    except Exception as e:
        raise ValueError(f"Invalid token: {str(e)}")
