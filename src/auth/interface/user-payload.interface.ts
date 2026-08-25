export interface UserPayload {
  name: string;
  email: string;
  role: 'admin' | 'user' | 'technician' | 'teamLeader' | 'superAdmin';
  serviceNum: string;
  iat: number;
  exp: number;
}
