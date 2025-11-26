"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

/**
 * PhotoCarousel (responsive, desktop shows full image)
 * - mobile/tablet: object-cover (fills area, may crop a bit)
 * - desktop (>= md): object-contain (shows whole image without zoom)
 * - fixed bug: use the desktopHeight prop value correctly
 */
function PhotoCarousel({ slides, interval = 3000, desktopHeight = "65vh", showIndicators = true }) {
  const [index, setIndex] = useState(0);
  const [running, setRunning] = useState(true);
  const timerRef = useRef(null);
  const [height, setHeight] = useState(desktopHeight);

  // responsive height
  useEffect(() => {
    function applyHeight() {
      const w = window.innerWidth;
      if (w < 640) setHeight("45vh");
      else if (w < 1024) setHeight("55vh");
      else setHeight(desktopHeight);
    }
    applyHeight();
    window.addEventListener("resize", applyHeight);
    return () => window.removeEventListener("resize", applyHeight);
  }, [desktopHeight]);

  // autoplay
  useEffect(() => {
    if (running) startTimer();
    return () => stopTimer();
  }, [index, running, slides.length]);

  function startTimer() {
    stopTimer();
    if (!running || slides.length <= 1) return;
    timerRef.current = setInterval(() => {
      setIndex((s) => (s + 1) % slides.length);
    }, interval);
  }

  function stopTimer() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }

  function pause() {
    setRunning(false);
    setTimeout(() => setRunning(true), 1000);
  }

  function prev() {
    setIndex((s) => (s - 1 + slides.length) % slides.length);
    pause();
  }
  function next() {
    setIndex((s) => (s + 1) % slides.length);
    pause();
  }
  function goTo(i) {
    setIndex(i);
    pause();
  }

  if (!slides.length) return null;

  return (
    <section className="relative w-full overflow-hidden select-none">
      <div className="relative w-full" style={{ height }}>
        {slides.map((s, i) => (
          <div
            key={(s.src || "") + i}
            className={`absolute inset-0 flex items-center justify-center transition-opacity duration-700 ${
              index === i ? "opacity-100 z-10" : "opacity-0 z-0"
            }`}
            style={{ pointerEvents: "none" }}
          >
            <img
              src={s.src}
              alt={s.alt}
              className="w-full h-full object-cover md:object-contain"
              draggable={false}
            />
          </div>
        ))}
      </div>

      {/* Prev / Next — MOBILE & TABLET ONLY */}
      <div className="absolute inset-0 flex items-center justify-between px-2 sm:px-6 pointer-events-none md:hidden">
        <button
          className="pointer-events-auto bg-blue-900 text-white p-3 rounded-full ml-2 shadow-lg hover:scale-105 transition-transform"
          onClick={prev}
        >
          ‹
        </button>

        <button
          className="pointer-events-auto bg-blue-900 text-white p-3 rounded-full mr-2 shadow-lg hover:scale-105 transition-transform"
          onClick={next}
        >
          ›
        </button>
      </div>

      {/* Indicators — MOBILE & TABLET ONLY */}
      {showIndicators && (
        <div className="absolute left-0 right-0 bottom-6 flex justify-center gap-2 px-4 md:hidden">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={`rounded-full transition-all ${
                index === i ? "w-4 h-4 bg-red-800" : "w-3 h-3 bg-black/40"
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
}


export default function Home() {
  const localFallback = [
    { src: "/mnt/data/b375b71c-66e4-4f0a-abab-3898b8ecec22.png", alt: "Sahaya event 1" },
    { src: "/mnt/data/caaf9965-4a8f-47cf-b417-aa7208ce3578.png", alt: "Sahaya location" },
  ];

  const [slides, setSlides] = useState(localFallback);

  useEffect(() => {
    let mounted = true;
    async function loadSlider() {
      try {
        const res = await fetch("/api/event-photos");
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || "Failed to fetch gallery");

        const slider = body.slider || body.home_slider || [];
        const mapped = slider
          .map((item) => ({
            src: item.optimized || item.original || item.thumb,
            alt: item.alt || "Home slider image",
          }))
          .filter(Boolean);

        if (mounted && mapped.length > 0) setSlides(mapped);
      } catch (e) {
        console.warn("Could not load home_slider, using fallback slides", e);
      }
    }
    loadSlider();
    return () => { mounted = false; };
  }, []);

  return (
    <div>
      {/* Photo-only hero carousel (responsive) */}
      <PhotoCarousel slides={slides} interval={1500} desktopHeight="100vh" showIndicators={true} />

      {/* CTA / Hero text */}
      <section className="py-8 sm:py-10" style={{ background: "var(--background)" }}>
        <div className="max-w-5xl mx-auto text-center px-4 sm:px-6">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-serif font-bold mb-4 sm:mb-6 bg-gradient-to-r from-indigo-600 to-green-600 bg-clip-text text-transparent">
            SAHAYA CHARITABLE TRUST
          </h1>

          <h2 className="hero-caption text-xl sm:text-2xl mb-3 sm:mb-6">Empowering Lives Through Compassion</h2>
          <p className="text-gray-800 text-sm sm:text-base mb-6 max-w-xl mx-auto">Sahaya Charitable Trust supports communities through education, healthcare, and empowerment initiatives.</p>

          <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4">
            <Link href="/donate" className="w-full sm:w-auto text-center bg-blue-900 text-white px-6 py-3 rounded-md text-lg font-semibold hover:bg-green-500 hover:-translate-y-0.5 hover:shadow-lg inline-block transition-all duration-300">
              Donate Now
            </Link>
            <Link href="/about" className="w-full sm:w-auto text-center inline-block px-6 py-3 rounded-md border border-white/20 font-bold hover:bg-black/60 hover:text-white text-gray-900 bg-white/10 transition-transform hover:-translate-y-0.5 duration-300">
              About Us
            </Link>
          </div>
        </div>
      </section>

      {/* Programs preview */}
      <section className="py-8 sm:py-12" style={{ background: "var(--background)" }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-serif mb-6">Our Key Programs</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { title: "Education Support", desc: "Helping children continue their education with resources and scholarships." },
              { title: "Healthcare Camps", desc: "Free medical checkups and health awareness drives in rural areas." },
              { title: "Food Distribution", desc: "Providing nutritious meals to families in need." },
            ].map((p, i) => (
              <div key={i} className="rounded-xl shadow-md p-6 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 ease-out bg-gradient-to-r from-indigo-100 via-blue-300 to-indigo-100">
                <h3 className="font-serif text-xl sm:text-2xl mb-2">{p.title}</h3>
                <p className="para-prog text-sm text-gray-800">{p.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-6">
            <Link href="/programs" className="inline-block mt-4 text-blue-700 hover:text-blue-900 hover:-translate-y-0.5 transition-all duration-300">
              View All Programs →
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
