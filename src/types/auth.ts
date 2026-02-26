export interface User {
  id?: string;
  name: string;
  email?: string;
  role?: string;
}

export interface AuthSession {
  token: string;
  user: User;
}

export interface LoginPayload {
  email: string;
  password: string;
}
