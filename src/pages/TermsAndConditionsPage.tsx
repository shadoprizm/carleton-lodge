import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export const TermsAndConditionsPage = () => {
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
            <h1 className="text-4xl md:text-5xl font-serif text-blue-900 mb-2">Terms and Conditions</h1>
            <p className="text-stone-500 text-sm mb-10">Last updated: March 1, 2026</p>

            <div className="prose prose-stone max-w-none space-y-8 text-stone-700 leading-relaxed">

              <section>
                <h2 className="text-2xl font-serif text-blue-900 mb-3">1. Acceptance of Terms</h2>
                <p>
                  By accessing and using the Carleton Lodge No. 465 website and member portal ("the Site"),
                  you accept and agree to be bound by these Terms and Conditions. If you do not agree to
                  these terms, please do not use the Site. These terms apply to all visitors, users, and
                  members who access or use the Site.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-serif text-blue-900 mb-3">2. Use of the Site</h2>
                <p className="mb-3">You agree to use the Site only for lawful purposes and in accordance with these Terms. You agree not to:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Use the Site in any way that violates applicable local, provincial, national, or international laws or regulations.</li>
                  <li>Share your login credentials with any other person or use another member's credentials.</li>
                  <li>Attempt to gain unauthorised access to any part of the Site or its related systems.</li>
                  <li>Transmit any unsolicited or unauthorised advertising or promotional material.</li>
                  <li>Impersonate or attempt to impersonate any Lodge officer, member, or other person.</li>
                  <li>Engage in any conduct that restricts or inhibits any other user's enjoyment of the Site.</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-serif text-blue-900 mb-3">3. Member Accounts</h2>
                <p className="mb-3">
                  Access to certain features of the Site, including the members directory, summons documents,
                  and the document library, is restricted to verified members of Carleton Lodge No. 465.
                </p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>You are responsible for maintaining the confidentiality of your account credentials.</li>
                  <li>You must notify us immediately of any unauthorised use of your account.</li>
                  <li>Member accounts are for individual use only and may not be shared or transferred.</li>
                  <li>We reserve the right to terminate or suspend access to any account at our discretion.</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-serif text-blue-900 mb-3">4. Confidentiality of Lodge Materials</h2>
                <p>
                  Certain materials available through the member portal, including summons documents, minutes,
                  and correspondence, are confidential to members of Carleton Lodge No. 465. By accessing
                  these materials, you agree to treat them as confidential and not to share, reproduce,
                  distribute, or disclose them to non-members. This obligation is consistent with and in
                  addition to your existing Masonic obligations.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-serif text-blue-900 mb-3">5. Intellectual Property</h2>
                <p>
                  The content on this Site, including text, images, graphics, logos, and the compilation
                  thereof, is the property of Carleton Lodge No. 465 or its content suppliers and is
                  protected by Canadian and international copyright laws. You may not reproduce, distribute,
                  or create derivative works from any content on this Site without our express written
                  permission. Historical content may also be subject to the rights of the Grand Lodge of
                  Canada in the Province of Ontario.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-serif text-blue-900 mb-3">6. Members Directory</h2>
                <p>
                  The members directory is provided exclusively for Lodge communication and fellowship
                  purposes. Member contact information displayed in the directory may not be used for
                  commercial solicitation, third-party marketing, or any purpose unrelated to Lodge
                  business and fraternal communication. Misuse of directory information may result in
                  account suspension and referral to the Lodge for disciplinary consideration.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-serif text-blue-900 mb-3">7. Disclaimer of Warranties</h2>
                <p>
                  The Site is provided on an "as is" and "as available" basis without any warranties of
                  any kind, either express or implied. We do not warrant that the Site will be uninterrupted,
                  error-free, or free of viruses or other harmful components. We make no warranties regarding
                  the accuracy, completeness, or reliability of any content on the Site.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-serif text-blue-900 mb-3">8. Limitation of Liability</h2>
                <p>
                  To the fullest extent permitted by law, Carleton Lodge No. 465 shall not be liable for
                  any indirect, incidental, special, consequential, or punitive damages arising from your
                  use of, or inability to use, the Site or its content. Our total liability to you for
                  any claim arising from these Terms shall not exceed the amount, if any, paid by you to
                  access the Site.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-serif text-blue-900 mb-3">9. Third-Party Links</h2>
                <p>
                  The Site may contain links to third-party websites. These links are provided for your
                  convenience only. We have no control over the content of those sites and accept no
                  responsibility for them or for any loss or damage that may arise from your use of them.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-serif text-blue-900 mb-3">10. Governing Law</h2>
                <p>
                  These Terms and Conditions shall be governed by and construed in accordance with the
                  laws of the Province of Ontario and the federal laws of Canada applicable therein.
                  Any disputes arising under these Terms shall be subject to the exclusive jurisdiction
                  of the courts of Ontario.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-serif text-blue-900 mb-3">11. Changes to These Terms</h2>
                <p>
                  We reserve the right to modify these Terms and Conditions at any time. Changes will
                  be effective immediately upon posting to the Site. Your continued use of the Site
                  following the posting of revised Terms constitutes your acceptance of the changes.
                  We encourage you to review these Terms periodically.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-serif text-blue-900 mb-3">12. Contact Us</h2>
                <p>
                  If you have any questions about these Terms and Conditions, please contact us at:
                </p>
                <div className="mt-3 p-4 bg-stone-50 rounded-lg border border-stone-200">
                  <p className="font-semibold text-stone-800">Carleton Lodge No. 465</p>
                  <p>Carp, Ontario, West Ottawa</p>
                  <p>
                    Email:{' '}
                    <a href="mailto:info@carletonlodge465.org" className="text-blue-700 hover:text-blue-900 underline">
                      info@carletonlodge465.org
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
