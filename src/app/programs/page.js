// src/app/programs/page.js
"use client";

import React from "react";

export default function Programs() {
  const programs = [
    {
      title: "Education Support",
      desc: "Providing supplies and mentorship for children.",
    },
    {
      title: "Food Distribution",
      desc: "Regular meal drives for low-income families.",
    },
    {
      title: "Healthcare Assistance",
      desc: "Medical camps and awareness programs.",
    },
    {
      title: "Women Empowerment",
      desc: "Skill training and financial inclusion for women.",
    },
  ];

  return (
    <div className="py-8 sm:py-12" style={{ background: "var(--background)" }}>
      <section className="max-w-4xl md:max-w-6xl mx-auto px-4 sm:px-6">
        <h2 className="about-page font-bold text-2xl sm:text-3xl md:text-4xl font-serif mb-8 text-center">
          Our Initiatives
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {programs.map((p, i) => (
            <article
              key={i}
              className="rounded-xl p-6 bg-gradient-to-r from-indigo-100 via-blue-300 to-indigo-100 shadow-md hover:shadow-xl transform transition-transform duration-300 ease-out hover:-translate-y-1 touch-none"
              style={{ willChange: "transform" }}
              aria-labelledby={`prog-${i}`}
            >
              <h3 id={`prog-${i}`} className="font-serif text-xl sm:text-2xl text-gray-900 mb-2">
                {p.title}
              </h3>
              <p className="text-gray-700 text-sm sm:text-base">{p.desc}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
