import { motion } from 'framer-motion';
import { Link } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { SUPPORT_EMAIL, supportMailto } from '../lib/contact';

export const PrivacyPolicyPage = () => {
  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-blue-900 hover:text-blue-700 transition-colors mb-10 font-medium text-sm"
          >
            <ArrowLeft size={16} />
            Back to Home
          </Link>

          <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-8 md:p-12">
            <h1 className="text-4xl md:text-5xl font-serif text-blue-900 mb-2">Privacy Policy</h1>
            <p className="text-stone-500 text-sm mb-10">Last updated: August 10, 2026</p>

            <div className="prose prose-stone max-w-none space-y-8 text-stone-700 leading-relaxed">

              <section>
                <h2 className="text-2xl font-serif text-blue-900 mb-3">1. Introduction</h2>
                <p>
                  Carleton Lodge No. 465, Ancient Free and Accepted Masons of Canada ("the Lodge", "we", "us", or "our")
                  is committed to protecting your personal information and your right to privacy. This Privacy Policy
                  describes how we collect, use, and safeguard information when you use our website and member portal.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-serif text-blue-900 mb-3">2. Information We Collect</h2>
                <p className="mb-3">We may collect the following types of information:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Account Information:</strong> Name, email address, and password when you register for member access.</li>
                  <li><strong>Profile Information:</strong> Membership rank, contact details, and other information you choose to provide in your member profile.</li>
                  <li><strong>Account Activity:</strong> The most recent successful login and the most recent authenticated visit to the website. We do not retain page-by-page browsing history, device details, or IP addresses for this feature.</li>
                  <li><strong>Communications:</strong> Records of correspondence if you contact us by email or through our website.</li>
                  <li><strong>AI-Assisted Feature Content:</strong> Questions submitted to Lodge Guide and lodge emails or documents that an authorised administrator selects for Mailroom draft preparation.</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-serif text-blue-900 mb-3">3. How We Use Your Information</h2>
                <p className="mb-3">We use the information we collect to:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Provide and maintain member access to the Lodge portal and resources.</li>
                  <li>Send notifications about Lodge events, summons, and announcements.</li>
                  <li>Maintain and update the members directory (visible only to authenticated members).</li>
                  <li>Communicate important Lodge business and correspondence.</li>
                  <li>Generate source-grounded Lodge Guide answers and administrator-reviewed Mailroom drafts.</li>
                  <li>Support member accounts and identify accounts that may need sign-in assistance.</li>
                  <li>Improve and administer our website and services.</li>
                  <li>Comply with our obligations under applicable Masonic jurisdiction rules.</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-serif text-blue-900 mb-3">4. Sharing of Information</h2>
                <p className="mb-3">
                  We do not sell, trade, or rent your personal information to third parties. We may share your
                  information only in the following circumstances:
                </p>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Within the Lodge:</strong> Member information is accessible to other verified Lodge members through the members directory, in accordance with Lodge custom and practice.</li>
                  <li><strong>Account Activity:</strong> Login and latest-visit information is restricted to Lodge administrators and members who have been explicitly granted read-only Member Activity access by an administrator.</li>
                  <li><strong>Grand Lodge:</strong> We may share relevant information with the Grand Lodge of Canada in the Province of Ontario as required by our Masonic obligations.</li>
                  <li><strong>Service Providers:</strong> We use third-party processors including Supabase for authentication and data storage, Resend for email delivery and receipt, Vercel for website hosting, and OpenAI for the optional AI-assisted features.</li>
                  <li><strong>Legal Requirements:</strong> We may disclose information when required by law or to protect the rights and safety of the Lodge and its members.</li>
                </ul>
                <p className="mt-3">
                  OpenAI API inputs and outputs are not used to train OpenAI models by default unless the Lodge explicitly opts in. Our requests disable response storage, but provider abuse-monitoring logs may still be retained for a limited period under the provider&apos;s{' '}
                  <a href="https://platform.openai.com/docs/models/default-usage-policies-by-endpoint" className="text-blue-700 underline hover:text-blue-900">data controls</a>. AI-generated Mailroom drafts cannot publish without an authorised human review.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-serif text-blue-900 mb-3">5. Data Security</h2>
                <p>
                  We implement appropriate technical and organisational measures to protect your personal information
                  against unauthorised access, alteration, disclosure, or destruction. Your account is protected by
                  password authentication, and all data is transmitted over encrypted connections. However, no method
                  of transmission over the internet is completely secure, and we cannot guarantee absolute security.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-serif text-blue-900 mb-3">6. Data Retention</h2>
                <p>
                  We retain your personal information for as long as your membership account is active or as needed
                  to provide services. If you wish to deactivate your account or request deletion of your data,
                  please contact us. We may retain certain information as required by law or for legitimate Lodge
                  record-keeping purposes.
                </p>
                <p className="mt-3">
                  Lodge Guide answers are not automatically saved as Lodge records. Approved Mailroom imports retain the source email, file provenance, extracted draft, final reviewed content, and approval audit needed for Lodge record-keeping. Rejected and failed imports may also be retained for security, troubleshooting, and duplicate prevention.
                </p>
                <p className="mt-3">
                  The member activity feature overwrites the previous website-visit timestamp and retains only the latest known authenticated visit. Supabase authentication maintains the account&apos;s latest successful sign-in timestamp.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-serif text-blue-900 mb-3">7. Your Rights</h2>
                <p className="mb-3">Depending on your location, you may have the right to:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Access the personal information we hold about you.</li>
                  <li>Request correction of inaccurate or incomplete information.</li>
                  <li>Request deletion of your personal information, subject to our legal obligations.</li>
                  <li>Withdraw consent to receiving notifications at any time through your account settings.</li>
                </ul>
                <p className="mt-3">
                  To exercise any of these rights, please contact us at{' '}
                  <a href={supportMailto('Privacy request')} className="text-blue-700 hover:text-blue-900 underline">
                    {SUPPORT_EMAIL}
                  </a>.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-serif text-blue-900 mb-3">8. Cookies</h2>
                <p>
                  Our website uses essential cookies and local storage to maintain your login session and
                  preferences. We do not use advertising or tracking cookies. By using our site, you consent
                  to the use of these essential cookies.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-serif text-blue-900 mb-3">9. Third-Party Links</h2>
                <p>
                  Our website may contain links to external sites. We are not responsible for the privacy
                  practices of those sites and encourage you to review their privacy policies independently.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-serif text-blue-900 mb-3">10. Changes to This Policy</h2>
                <p>
                  We may update this Privacy Policy from time to time. We will notify members of significant
                  changes by posting a notice on the website. Your continued use of the site after changes
                  are posted constitutes your acceptance of the revised policy.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-serif text-blue-900 mb-3">11. Contact Us</h2>
                <p>
                  If you have any questions or concerns about this Privacy Policy or our data practices,
                  please contact us at:
                </p>
                <div className="mt-3 p-4 bg-stone-50 rounded-lg border border-stone-200">
                  <p className="font-semibold text-stone-800">Carleton Lodge No. 465</p>
                  <p>Carp, Ontario, West Ottawa</p>
                  <p>
                    Email:{' '}
                    <a href={supportMailto('Privacy policy question')} className="text-blue-700 hover:text-blue-900 underline">
                      {SUPPORT_EMAIL}
                    </a>
                  </p>
                </div>
              </section>

            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
