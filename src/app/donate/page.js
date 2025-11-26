// src/app/donate/page.js
"use client";

export default function Donate() {
  return (
    <div style={{ background: "var(--background)" }}>
      <section className="max-w-4xl md:max-w-6xl mx-auto py-8 px-4 sm:py-12 sm:px-6">
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-serif font-bold mb-4">Donate & Support Us</h2>

        <p className="text-gray-800 mb-6 max-w-2xl">
          Your small contribution can bring a big change in someone's life. Below are the
          bank details and UPI information for easy donations. Thank you for supporting Sahaya Charitable Trust.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Bank details */}
          <div className="bg-white p-5 shadow rounded-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300 ease-out bg-gradient-to-r from-indigo-100 via-blue-300 to-indigo-100">
            <h3 className="text-lg font-semibold mb-3">Bank Details</h3>

            <div className="space-y-2 text-gray-800">
              <p>Account Name: <strong>Sahaya Charitable Trust</strong></p>
              <p>Account Number: <strong>1234567890</strong></p>
              <p>IFSC: <strong>SBIN0000123</strong></p>
              <p>Bank: <strong>State Bank of India</strong></p>
            </div>

            <div className="mt-4">
              <p className="text-sm text-gray-600">For bank transfers, please include your name in the transaction remark so we can send a receipt.</p>
            </div>
          </div>

          {/* UPI / QR */}
          <div className="bg-white p-5 shadow rounded-lg flex flex-col items-center gap-4 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 ease-out bg-gradient-to-r from-indigo-100 via-blue-300 to-indigo-100">
            <h3 className="text-lg font-semibold">UPI Payment</h3>

            <p className="text-gray-800">UPI ID: <strong>sahaya@upi</strong></p>

            <div className="w-44 h-44 bg-white rounded shadow flex items-center justify-center overflow-hidden">
              <img
                src="/images/qr.png"
                alt="UPI QR Code"
                className="w-full h-full object-contain"
                loading="lazy"
              />
            </div>

            <p className="text-sm text-gray-600 text-center">
              Scan the QR code with your UPI app or send to the UPI ID shown above.
            </p>
          </div>
        </div>

        {/* CTA & note */}
        <div className="mt-8 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
         {/* <div className="text-sm text-gray-700">
            Donations are used only for charitable activities and are tax-exempt as per prevailing laws.
          </div> */}

       <div className="flex gap-3">
          {/*    <a href="/donate" className="inline-block px-4 py-2 bg-green-500 text-white rounded shadow">Donate Online</a>*/}
            <a href="/contact" className="inline-block px-4 py-2 border rounded">Contact Us</a>
          </div>
        </div>
      </section>
    </div>
  );
}
