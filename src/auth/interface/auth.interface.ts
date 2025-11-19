export interface User {
  id: string;
  email: string;
  serviceNum: string;
  name: string;
  role: 'admin' | 'user' | 'technician' | 'teamLeader' | 'superAdmin';
  contactNumber?: string;
}

export interface DecodedIdToken {
  oid?: string;
  preferred_username?: string;
  name?: string;
  // Add other properties you expect in the ID token payload
}

export interface MicrosoftTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  id_token?: string;
  refresh_token?: string;
}

export interface JwtPayload {
  name: string;
  email: string;
  role: 'admin' | 'user' | 'technician' | 'teamLeader' | 'superAdmin';
  serviceNum: string;
  exp?: number; // Expiration time
  iat?: number; // Issued at time
}
