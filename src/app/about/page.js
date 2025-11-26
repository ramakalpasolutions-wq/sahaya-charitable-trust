"use client";

import { useState } from "react";

export default function About() {
  const [visionOpen, setVisionOpen] = useState(true);
  const [missionOpen, setMissionOpen] = useState(false);

  return (
    <div className="py-8 sm:py-12" style={{ background: "var(--background)" }}>
      <section className="max-w-3xl sm:max-w-4xl md:max-w-6xl mx-auto px-4 sm:px-6">
        {/* MAIN TITLE */}
        <h2 className="about-page text-2xl sm:text-3xl md:text-4xl font-serif font-bold mb-4 leading-tight text-gray-900">
          About Sahaya Charitable Trust
        </h2>

        {/* INTRODUCTION */}
        <p className="text-gray-900 font-medium mb-3 text-sm sm:text-base">
          Sahaya Charitable Trust is a non-profit organization dedicated to uplifting
          underprivileged individuals through education, healthcare, food support,
          social welfare, and community development programs.
        </p>

        <p className="text-gray-900 font-medium mb-6 text-sm sm:text-base">
          The Trust was established with a core purpose of serving society by focusing on
          key development areas such as rural upliftment, environmental care, medical
          support, educational empowerment, and emergency relief activities.
        </p>

        {/* VISION (card) */}
        <div className="mb-4">
          {/* Mobile accordion header */}
          <div className="md:hidden">
            <button
              onClick={() => setVisionOpen((s) => !s)}
              aria-expanded={visionOpen}
              className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-indigo-100 via-blue-300 to-indigo-100 rounded-2xl shadow-md"
            >
              <div>
                <h3 className="text-lg font-semibold">Our Vision</h3>
                <p className="text-xs text-gray-700 mt-1">Tap to {visionOpen ? "collapse" : "expand"}</p>
              </div>
              <div className="text-2xl font-bold">{visionOpen ? "−" : "+"}</div>
            </button>

            {visionOpen && (
              <div className="mt-3 p-4 bg-gradient-to-r from-indigo-100 via-blue-300 to-indigo-100 rounded-2xl shadow-md text-gray-700">
                <p className="mb-3 text-sm">
                  To build a compassionate and empowered society where every individual—irrespective of economic or social background—has access to education, healthcare, security, and dignity.
                </p>
                <p className="text-sm">
                  Our vision is to uplift economically disadvantaged communities by improving their quality of life, providing equal opportunities, promoting social harmony, and helping them become self-reliant.
                </p>
              </div>
            )}
          </div>

          {/* Desktop / Tablet card (always expanded) */}
          <div className="hidden md:block p-6 bg-gradient-to-r from-indigo-100 via-blue-300 to-indigo-100 rounded-2xl shadow-lg transition-all hover:-translate-y-2 hover:shadow-2xl">
            <h3 className="text-2xl font-semibold mt-2 mb-2">Our Vision</h3>
            <p className="text-gray-700 mb-4">
              To build a compassionate and empowered society where every individual—
              irrespective of economic or social background—has access to education,
              healthcare, security, and dignity.
            </p>

            <p className="text-gray-700">
              Our vision is to uplift economically disadvantaged communities by improving
              their quality of life, providing equal opportunities, promoting social
              harmony, and helping them become self-reliant.
            </p>
          </div>
        </div>

        {/* MISSION (card) */}
        <div className="mb-6">
          {/* Mobile accordion header */}
          <div className="md:hidden">
            <button
              onClick={() => setMissionOpen((s) => !s)}
              aria-expanded={missionOpen}
              className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-indigo-100 via-blue-300 to-indigo-100 rounded-2xl shadow-md"
            >
              <div>
                <h3 className="text-lg font-semibold">Our Mission</h3>
                <p className="text-xs text-gray-700 mt-1">Tap to {missionOpen ? "collapse" : "expand"}</p>
              </div>
              <div className="text-2xl font-bold">{missionOpen ? "−" : "+"}</div>
            </button>

            {missionOpen && (
              <div className="mt-3 p-4 bg-gradient-to-r from-indigo-100 via-blue-300 to-indigo-100 rounded-2xl shadow-lg text-gray-700 space-y-3">
                <p className="text-sm">
                  • To promote accessible healthcare by organizing medical camps, awareness programs, and providing medical assistance to needy individuals.
                </p>
                <p className="text-sm">
                  • To support children and youth through education assistance, scholarships, awareness drives, learning resources, and skill-development programs.
                </p>
                <p className="text-sm">
                  • To provide food, clothing, emergency relief, and rehabilitation for vulnerable communities including widows, senior citizens, orphans, and differently-abled individuals.
                </p>
                <p className="text-sm">
                  • To encourage cultural activities, sports, fine arts, and leadership development programs for holistic community growth.
                </p>
                <p className="text-sm">
                  • To dedicate continuous efforts towards rural development, sanitation, environmental protection, and creating sustainable living conditions.
                </p>
                <p className="text-sm">
                  • To operate with complete transparency, accountability, and compliance with all legal frameworks — ensuring that all funds are used solely for charitable purposes.
                </p>
              </div>
            )}
          </div>

          {/* Desktop / Tablet mission card (expanded) */}
          <div className="hidden md:block p-6 bg-gradient-to-r from-indigo-100 via-blue-300 to-indigo-100 rounded-2xl shadow-lg transition-all hover:-translate-y-2 hover:shadow-2xl">
            <h3 className="text-2xl font-semibold mt-2 mb-2">Our Mission</h3>

            <div className="text-gray-700 space-y-3">
              <p>
                • To promote accessible healthcare by organizing medical camps, awareness
                programs, and providing medical assistance to needy individuals.
              </p>

              <p>
                • To support children and youth through education assistance, scholarships,
                awareness drives, learning resources, and skill-development programs.
              </p>

              <p>
                • To provide food, clothing, emergency relief, and rehabilitation for
                vulnerable communities including widows, senior citizens, orphans, and
                differently-abled individuals.
              </p>

              <p>
                • To encourage cultural activities, sports, fine arts, and leadership
                development programs for holistic community growth.
              </p>

              <p>
                • To dedicate continuous efforts towards rural development, sanitation,
                environmental protection, and creating sustainable living conditions.
              </p>

              <p>
                • To operate with complete transparency, accountability, and compliance with
                all legal frameworks — ensuring that all funds are used solely for
                charitable purposes.
              </p>
            </div>
          </div>
        </div>

      </section>
    </div>
  );
}
