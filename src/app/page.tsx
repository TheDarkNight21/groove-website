import { VinylMark } from "@/components/VinylMark";
import { WaitlistForm } from "@/components/WaitlistForm";
import {
  AUDIENCE,
  INGREDIENTS,
  SHORT_VERSION,
  SITE,
  WHY,
} from "@/content/site";

const Section = ({ id, title, children }: { id: string; title: string; children: React.ReactNode }) => (
  <section aria-labelledby={id} className="border-t border-foreground py-16 sm:py-24">
    <div className="grid gap-8 sm:grid-cols-[14rem_1fr]">
      <h2 id={id} className="text-sm uppercase tracking-widest">
        {title}
      </h2>
      <div className="max-w-2xl">{children}</div>
    </div>
  </section>
);

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-5xl px-6 sm:px-10">
      <header className="flex items-center justify-between py-8">
        <div className="flex items-center gap-3">
          <VinylMark size={32} />
          <span className="text-lg font-medium tracking-tight">{SITE.name}</span>
        </div>
        <span className="text-sm uppercase tracking-widest">{SITE.status}</span>
      </header>

      <section className="py-24 sm:py-40">
        <h1 className="max-w-3xl text-4xl font-medium leading-[1.05] tracking-tight sm:text-7xl">
          {SITE.tagline}
        </h1>
        <p className="mt-8 max-w-xl text-base leading-relaxed sm:text-lg">
          {SITE.description}
        </p>
        <div id="waitlist" className="mt-12 max-w-xl">
          <WaitlistForm />
        </div>
      </section>

      <Section id="short" title="The short version">
        <p className="text-lg leading-relaxed">{SHORT_VERSION}</p>
      </Section>

      <Section id="why" title="Why we’re building it">
        <div className="space-y-5 text-lg leading-relaxed">
          {WHY.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
      </Section>

      <Section id="inside" title="What goes into it">
        <ul className="space-y-8">
          {INGREDIENTS.map(({ title, body }) => (
            <li key={title}>
              <h3 className="font-medium">{title}</h3>
              <p className="mt-2 leading-relaxed">{body}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="people" title="For people in the groove">
        <p className="text-lg leading-relaxed">{AUDIENCE}</p>
      </Section>

      <footer className="border-t border-foreground py-12">
        <ul className="grid gap-4 sm:grid-cols-2">
          {SITE.social.map(({ label, handle, href }) => (
            <li key={href}>
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex flex-col underline-offset-4 hover:underline"
              >
                <span className="text-sm uppercase tracking-widest">{label}</span>
                <span className="mt-1 text-lg">{handle} →</span>
              </a>
            </li>
          ))}
        </ul>
        <p className="mt-12 text-sm">© {SITE.name}. {SITE.status}</p>
      </footer>
    </main>
  );
}
