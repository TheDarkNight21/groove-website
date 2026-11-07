import type { SITE } from "@/content/site";

type Social = (typeof SITE.social)[number];

// One account to follow: what it's for, the handle, and which app it opens, so nobody
// has to guess. Opens in a new tab; the page stays where it was.
export function SocialLink({ social, label, className }: { social: Social; label?: string; className?: string }) {
  return (
    <a href={social.href} target="_blank" rel="noopener noreferrer" className={className ? `social ${className}` : "social"}>
      <span className="eyebrow">{label ?? social.label}</span>
      <span>{social.handle} →</span>
      <span className="social-app">on {social.app}</span>
    </a>
  );
}
