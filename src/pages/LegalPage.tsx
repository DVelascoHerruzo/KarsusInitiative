import type { ReactNode } from 'react'
import { Link } from 'react-router'
import Layout, { PageHeader } from '@/components/ui/Layout'
import { useAuth } from '@/features/auth/AuthProvider'
import { CONTACT_EMAIL, KOFI_URL, LEGAL_UPDATED, SITE_NAME } from '@/lib/legal'

function LegalLayout({ title, children }: { title: string; children: ReactNode }) {
  const { user } = useAuth()
  return (
    <Layout title={title} guest={!user}>
      <title>{`${title} · Karsus`}</title>
      <article className="mx-auto max-w-3xl space-y-6">
        <PageHeader back={{ to: '/', label: 'Home' }} eyebrow={`Last updated ${LEGAL_UPDATED}`} title={title} />
        <div className="dnd-card space-y-6 p-6 font-ui leading-relaxed text-dnd-parchment sm:p-8 [&_a]:text-dnd-jade [&_a]:underline [&_h2]:mb-2 [&_h2]:font-body [&_h2]:text-lg [&_h2]:tracking-widest [&_h2]:text-dnd-gold [&_h2]:uppercase [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1">
          {children}
        </div>
      </article>
    </Layout>
  )
}

const contact = CONTACT_EMAIL ? (
  <>
    email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
  </>
) : (
  <>the contact details on this page</>
)

export function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy">
      <p>
        {SITE_NAME} (“Karsus”) is a free tool for running tabletop combat. This page explains what we store about you, why, who else handles it, and how to get a copy
        or delete it. In short: we keep what the site needs to work, nothing more, and we never sell it or use it for advertising.
      </p>

      <section>
        <h2>What we store</h2>
        <ul>
          <li>
            <b>Your account:</b> your email, the display name you choose, and your password as a one-way scrypt hash (we can’t read it). If you sign in with Google, the
            account id Google gives us, and your name and email from Google.
          </li>
          <li>
            <b>What you make:</b> encounters, campaigns, creatures, character sheets, notes, folders, and the images you upload.
          </li>
          <li>
            <b>Security records:</b> failed sign-in counts, password reset tokens (deleted after an hour), and rate-limit counters. Counters are keyed by a one-way hash
            of your IP address or email, never the address itself, and are deleted within about two hours.
          </li>
          <li>
            <b>Live status:</b> when a DM has an encounter open, a note that it’s live, deleted about two minutes after they leave.
          </li>
        </ul>
        <p className="mt-2">We don’t use analytics, advertising or tracking tools.</p>
      </section>

      <section>
        <h2>Who can see it</h2>
        <ul>
          <li>The DM of a campaign or encounter, and any co-DMs, see what’s in it, including the character sheets and notes of players in it.</li>
          <li>Players see what the DM shares: never DM notes, hidden creatures, or monsters’ exact numbers.</li>
          <li>Anyone with a player-view or invite link you send can open what it leads to. Uploaded images can be viewed by anyone who has their address.</li>
        </ul>
      </section>

      <section>
        <h2>Who handles it for us</h2>
        <ul>
          <li>
            <b>Microsoft Azure</b> runs the site and stores the data: the database in Sweden, images in Ireland, and the website and its API in the United States
            (East US 2), under Microsoft’s EU Standard Contractual Clauses. Microsoft also sends password reset emails.
          </li>
          <li>
            <b>Cloudflare</b> carries traffic to the site and protects it from attacks.
          </li>
          <li>
            <b>Google</b>, only if you choose “Continue with Google”.
          </li>
          <li>
            <b>Have I Been Pwned</b>: when you set a password we send the first five characters of its SHA-1 hash, never the password, to check it hasn’t leaked in a
            known breach.
          </li>
          <li>
            <b>D&amp;D Beyond</b>: when you import a character, we fetch that public character from D&amp;D Beyond.
          </li>
        </ul>
      </section>

      <section>
        <h2>Why (legal basis)</h2>
        <p>
          We process your data to provide the service you signed up for (contract), and to keep it secure and free of abuse (legitimate interest): rate limits,
          breach checks and lockouts.
        </p>
      </section>

      <section>
        <h2>Cookies and storage</h2>
        <ul>
          <li>
            <code>karsus_session</code> keeps you signed in, for up to a year after your last visit. It’s strictly necessary, can’t be read by scripts, and is only
            sent to our API.
          </li>
          <li>
            <code>karsus_oauth</code> exists for ten minutes while you sign in with Google.
          </li>
          <li>Your browser’s local storage remembers your colour theme and the offline demo. It never leaves your device.</li>
        </ul>
        <p className="mt-2">There are no advertising or tracking cookies, so there’s nothing to consent to.</p>
      </section>

      <section>
        <h2>How long we keep it</h2>
        <p>
          Until you delete it. Deleting an encounter, campaign or your whole account removes it straight away. Our database provider keeps short-lived backups, which
          roll over within a day.
        </p>
      </section>

      <section>
        <h2>Your rights</h2>
        <ul>
          <li>
            <b>Get a copy</b> of your data: <Link to="/account">Account &amp; Security → Download My Data</Link>.
          </li>
          <li>
            <b>Correct</b> it: edit it anywhere on the site.
          </li>
          <li>
            <b>Delete</b> it: <Link to="/account">Account &amp; Security → Delete My Account</Link>.
          </li>
          <li>
            <b>Object or ask a question</b>: {contact}. You can also complain to your data protection authority (in Spain, the AEPD).
          </li>
        </ul>
      </section>

      <section>
        <h2>Children</h2>
        <p>Karsus isn’t meant for children under 14. If you’re younger, please ask a parent or guardian before signing up.</p>
      </section>

      <section>
        <h2>Changes</h2>
        <p>If this policy changes, the date at the top changes too. Significant changes will be announced on the site.</p>
      </section>
    </LegalLayout>
  )
}

export function TermsPage() {
  return (
    <LegalLayout title="Terms of Use">
      <p>
        By using {SITE_NAME} you agree to these terms. They’re short because the site is simple: a free tool for running tabletop combat with your friends.
      </p>

      <section>
        <h2>Your account</h2>
        <p>Keep your password to yourself. You’re responsible for what happens under your account. If you think someone else got in, change your password; that signs out every other device.</p>
      </section>

      <section>
        <h2>Your content</h2>
        <ul>
          <li>What you create and upload stays yours. You let us store it and show it to the people you share it with, only so the site can work.</li>
          <li>Only upload images and text you have the right to use. Art you find online usually belongs to its artist.</li>
          <li>Don’t use Karsus for anything illegal, hateful, harassing or sexual involving minors, or to attack the site or other people.</li>
          <li>We may remove content or close accounts that break these rules, or when the law requires it.</li>
        </ul>
      </section>

      <section>
        <h2>Fan content</h2>
        <p>
          Karsus is an unofficial fan tool. It isn’t affiliated with, endorsed, sponsored or approved by Wizards of the Coast. Dungeons &amp; Dragons and D&amp;D are
          trademarks of Wizards of the Coast LLC. D&amp;D Beyond is a trademark of its owners; importing uses characters their owners have made public.
        </p>
      </section>

      <section>
        <h2>Free, as is</h2>
        <p>
          Karsus is free and provided as it is. We work to keep it running and your data safe, but we can’t promise it will always be available or free of errors, and
          we’re not liable for losses from using it, as far as the law allows. Keep your own copy of anything important: you can download your data any time. Support
          on <a href={KOFI_URL}>Ko-fi</a> is optional and doesn’t buy extra features.
        </p>
      </section>

      <section>
        <h2>Leaving</h2>
        <p>
          You can delete your account whenever you like from <Link to="/account">Account &amp; Security</Link>. See the <Link to="/privacy">Privacy Policy</Link> for
          what that removes.
        </p>
      </section>

      <section>
        <h2>Changes</h2>
        <p>If these terms change, the date at the top changes too. Using the site after a change means you accept the new terms.</p>
      </section>
    </LegalLayout>
  )
}
