// src/app/contact/page.js
"use client";

export default function Contact() {
  return (
    <div style={{ background: "var(--background)" }}>
      <section className="max-w-4xl md:max-w-6xl mx-auto py-8 px-4 sm:py-12 sm:px-6">
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-serif font-bold mb-4">Contact Us</h2>

        <p className="text-gray-800 mb-4 max-w-2xl">
          Feel free to reach out to us for donations, volunteering, or general queries.
          We’re happy to help and will respond as soon as possible.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Contact card */}
          <div className="bg-white p-5 shadow rounded-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300 ease-out bg-gradient-to-r from-indigo-100 via-blue-300 to-indigo-100">
            <h3 className="text-lg font-semibold mb-3">Get in Touch</h3>

            <div className="space-y-2 text-gray-800">
              <p className="flex items-start gap-2">
                <span aria-hidden>📍</span>
                <span>Guntur, Andhra Pradesh</span>
              </p>

              <p className="flex items-start gap-2">
                <span aria-hidden>📞</span>
                <a href="tel:+919876543210" className="hover:underline">+91 94946 76669</a>
              </p>

              <p className="flex items-start gap-2">
                <span aria-hidden>📧</span>
                <a href="mailto:sahayacharitabletrustt@gmail.com" className="hover:underline">sahayacharitabletrustt@gmail.com</a>
              </p>

              <p className="text-sm text-gray-600 mt-2">
                We will respond within 24 hours. For urgent matters please call the phone number above.
              </p>
            </div>
          </div>

          {/* Map & address */}
          <div className="bg-white p-0 shadow rounded-lg overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 ease-out bg-gradient-to-r from-indigo-100 via-blue-300 to-indigo-100">
            <div className="w-full h-44 sm:h-56 md:h-48">
              <iframe
                src="https://www.google.com/maps?q=Door+No.+1-42/4/C,+S.C+Colony,+Mandapadu+village,+Medikonduru+mandal,+Guntur+district,+522401&output=embed"
                title="Sahaya Charitable Trust location"
                className="w-full h-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>

            <div className="p-4">
              <h4 className="font-semibold mb-1">Address</h4>
              <p className="text-sm text-gray-700 leading-relaxed">
                Door No. 1-42/4/C,<br />
                S.C Colony,<br />
                Mandapadu Village,<br />
                Medikonduru Mandal,<br />
                Guntur District – 522401
              </p>
            </div>
          </div>
        </div>

        {/* Optional contact form (simple, client-side only) 
        <div className="mt-8">
          <h3 className="text-lg font-semibold mb-3">Send a message</h3>
          <form
            action="#"
            onSubmit={(e) => {
              e.preventDefault();
              // client-side only: you can wire this to an API endpoint
              alert("Thanks — your message has been noted (demo).");
            }}
            className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white p-4 rounded-lg shadow"
          >
            <input name="name" placeholder="Your name" className="p-3 border rounded" required />
            <input name="email" type="email" placeholder="Email" className="p-3 border rounded" required />
            <input name="subject" placeholder="Subject" className="p-3 border rounded col-span-1 sm:col-span-2" />
            <textarea name="message" placeholder="Message" rows={4} className="p-3 border rounded col-span-1 sm:col-span-2" required />
            <div className="col-span-1 sm:col-span-2 flex justify-end">
              <button type="submit" className="px-4 py-2 bg-blue-900 text-white rounded">Send Message</button>
            </div>
          </form>
        </div>*/}
      </section>
    </div>
  );
}
