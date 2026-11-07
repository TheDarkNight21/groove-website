import { SITE } from "@/content/site";

// Groove's accounts as one group under one line: each handle names the app it opens, so
// nobody has to guess. Links open in a new tab; the page stays where it was.
export function FollowGroove({ label = SITE.follow, className }: { label?: string; className?: string }) {
  return (
    <div className={className ? `follow ${className}` : "follow"}>
      <span className="eyebrow">{label}</span>
      {SITE.social.map((s) => (
        <a key={s.href} href={s.href} target="_blank" rel="noopener noreferrer" className="follow-link">
          <span>{s.handle} →</span>
          <span className="social-app">on {s.app}</span>
        </a>
      ))}
    </div>
  );
}
