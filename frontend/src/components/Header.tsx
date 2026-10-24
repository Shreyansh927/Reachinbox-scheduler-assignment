import { LogOut, Mail } from "lucide-react";
import type { User } from "../types/email";

type Props = { user: User; onLogout: () => void };

export default function Header({ user, onLogout }: Props) {
  return (
    <header className="topbar">
      <a className="brand" href="/">
        <span className="brand-icon">
          <Mail size={19} />
        </span>
        <span>
          reachinbox<span className="brand-light">.</span>
        </span>
      </a>
      <div className="profile">
        {user.avatar ? (
          <img className="avatar" src={user.avatar} alt={user.name} />
        ) : (
          <span className="avatar fallback">{user.name.slice(0, 1)}</span>
        )}
        <div className="profile-copy">
          <strong>{user.name}</strong>
          <span>{user.email}</span>
        </div>
        <button className="icon-button" title="Log out" onClick={onLogout}>
          <LogOut size={17} />
        </button>
      </div>
    </header>
  );
}
