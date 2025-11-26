// src/app/components/Footer.js
import Link from "next/link";  
import { FaFacebookF, FaInstagram, FaTwitter, FaYoutube } from "react-icons/fa6";




export default function Footer() {
  return (
    <footer className="text-gray-300">

      {/* ============================ */}
      {/* DESKTOP FOOTER */}
      {/* ============================ */}
      <div className="hidden md:block bg-[#00defc3f]">
        <div className="max-w-screen-xl mx-auto px-6 py-10 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-10">
          
          {/* Social */}
          <div>
            
            <h3 className="font-bold mb-3">Follow Us</h3>
            <p className="text-sm mb-3">Stay connected — join our community on social media.</p>
            

            <div className="flex gap-4">
              <div className="flex gap-6 text-black text-xl">
    <a
      href="https://facebook.com"
      target="_blank"
      className="hover:text-blue-500"
    >
      <FaFacebookF />
    </a>

    <a
      href="https://instagram.com"
      target="_blank"
      className="hover:text-pink-500"
    >
      <FaInstagram />
    </a>

    <a
      href="https://twitter.com"
      target="_blank"
      className="hover:text-sky-500"
    >
      <FaTwitter />
    </a>

    <a
      href="https://youtube.com"
      target="_blank"
      className="hover:text-red-500"
    >
      <FaYoutube />
    </a>
  </div>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-bold mb-3">Quick Links</h3>
            <ul className="space-y-2 text-sm">
              <Link href="/" className="hover:text-blue-300 block">Home</Link>
              <Link href="/about" className="hover:text-blue-300 block">About</Link>
              <Link href="/programs" className="hover:text-blue-300 block">Programs</Link>
              <Link href="/donate" className="hover:text-blue-300 block">Donate</Link>
              <Link href="/contact" className="hover:text-blue-300 block">Contact</Link>
            </ul>
          </div>

          {/* About */}
          <div>
            <h3 className="font-bold mb-3">About</h3>
            <p className="text-sm mb-2">
              Sahaya Charitable Trust supports underprivileged communities through food drives,
              education programs, medical camps, and emergency relief.
            </p>
            <p className="text-xs text-slate-700">Registered charity — empowering lives with care.</p>
          </div>

          {/* Location */}
          <div>
            <h3 className="font-semibold mb-3">Our Location</h3>
            <iframe
              width="100%"
              height="160"
              className="rounded shadow"
              loading="lazy"
              src="https://www.google.com/maps?q=Door+No.+1-42/4/C,+S.C+Colony,+Mandapadu+village,+Medikonduru+mandal,+Guntur+district,+522401&output=embed"
            />
            <p className="text-sm leading-relaxed mt-3">
              Door No. 1-42/4/C,<br />
              S.C Colony,<br />
              Mandapadu Village,<br />
              Medikonduru Mandal,<br />
              Guntur District – 522401
            </p>
          </div>
        </div>

        <div className="border-t border-gray-300 mt-4 pt-6 text-center pb-6">
          <p className="text-xs text-gray-700">© {new Date().getFullYear()} Sahaya Charitable Trust. All rights reserved.</p>
        </div>
      </div>


      {/* ============================ */}
      {/* MOBILE FOOTER CONTENT + INFO */}
      {/* ============================ */}
      <div className="md:hidden p-5 bg-[#00defc3f] mt-12 rounded-xl">

        {/* SOCIAL MOBILE */}
 
<div className="mb-6">
  <h3 className="font-bold mb-2 text-black">Follow Us</h3>

  <div className="flex gap-6 text-black text-xl">
    <a
      href="https://facebook.com"
      target="_blank"
      className="hover:text-blue-500"
    >
      <FaFacebookF />
    </a>

    <a
      href="https://instagram.com"
      target="_blank"
      className="hover:text-pink-500"
    >
      <FaInstagram />
    </a>

    <a
      href="https://twitter.com"
      target="_blank"
      className="hover:text-sky-500"
    >
      <FaTwitter />
    </a>

    <a
      href="https://youtube.com"
      target="_blank"
      className="hover:text-red-500"
    >
      <FaYoutube />
    </a>
  </div>
</div>


        {/* ABOUT MOBILE */}
        <div className="mb-6">
          <h3 className="font-bold mb-2 text-black">About</h3>
          <p className="text-sm text-black">
            Sahaya Charitable Trust supports underprivileged communities through food drives,
            education programs, medical camps, and emergency relief.
          </p>
        </div>

        {/* LOCATION MOBILE */}
        <div className="mb-6">
          <h3 className="font-bold mb-2 text-black">Our Location</h3>
          <iframe
            width="100%"
            height="160"
            className="rounded shadow"
            loading="lazy"
            src="https://www.google.com/maps?q=Door+No.+1-42/4/C,+S.C+Colony,+Mandapadu+village,+Medikonduru+mandal,+Guntur+district,+522401&output=embed"
          />

          <p className="text-sm leading-relaxed mt-3 text-black">
            Door No. 1-42/4/C,<br />
            S.C Colony,<br />
            Mandapadu Village,<br />
            Medikonduru Mandal,<br />
            Guntur District – 522401
          </p>
        </div>

      </div>


      {/* ============================ */}
      {/* MOBILE STICKY BUTTON BAR */}
      {/* ============================
      <div className="md:hidden fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[94%]">
        <div className="bg-[#00defc3f] backdrop-blur rounded-xl p-2 flex items-center justify-between shadow">
          <div className="flex items-center gap-2">
            <img src="/turst-logo.webp" className="w-8 h-8 rounded-md" />
            <span className="text-xs font-semibold text-black">Sahaya Trust</span>
          </div>

          <div className="flex gap-2">
            <Link href="/donate" className="px-3 py-1 bg-green-500 text-white text-xs rounded">
              Donate
            </Link>
            <Link href="/contact" className="px-3 py-1 border text-xs rounded">
              Contact
            </Link>
          </div>
        </div>
      </div> */}

      <div className="md:hidden h-20" />
    </footer>
  );
}
