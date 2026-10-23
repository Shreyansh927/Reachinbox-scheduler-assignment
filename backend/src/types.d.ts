import "express-session";

declare global {
  namespace Express {
    interface User {
      id: string;
      google_id?: string;
      name: string;
      email: string;
      avatar?: string | null;
    }
  }
}
