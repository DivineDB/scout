import React from "react";
import meData from "@/data/me.json";

export default function ProfilePage() {
  return (
    <div className="flex-1 overflow-auto p-8 relative">
      {/* Dynamic Background */}
      <div className="pointer-events-none fixed inset-0 -z-10 h-full w-full bg-white [background:radial-gradient(125%_125%_at_50%_10%,#fff_40%,#F1F5F9_100%)]" />

      <div className="mx-auto max-w-5xl space-y-8">
        <header>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">
            My Profile
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Data used by Scout to find the perfect matches for you.
          </p>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {/* Identity & Contact */}
          <div className="glass p-6 rounded-2xl border border-slate-200 bg-[#FBFBFB] flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-700 font-black text-2xl border border-emerald-200 shadow-inner">
                {meData.name.split(" ").map(n => n[0]).join("")}
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">{meData.name}</h2>
                <p className="text-sm text-slate-500 font-medium">{meData.degree} '{meData.graduation_year.toString().slice(2)}</p>
              </div>
            </div>
            
            <div className="space-y-2 mt-2">
              <div className="flex flex-col text-sm">
                <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Location</span>
                <span className="text-slate-700 font-medium">{meData.location.city}, {meData.location.state}</span>
              </div>
              <div className="flex flex-col text-sm">
                <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Contact</span>
                <span className="text-slate-700 font-medium">{meData.contact.email}</span>
                <span className="text-slate-700 font-medium">{meData.contact.phone}</span>
              </div>
            </div>
          </div>

          {/* Preferences (Editable Dashboard Style) */}
          <div className="glass p-6 rounded-2xl border border-slate-200 bg-[#FBFBFB] lg:col-span-2 flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute top-4 right-4 bg-white/80 backdrop-blur border border-slate-200 px-3 py-1 rounded-full text-xs font-bold text-slate-500 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer hover:bg-slate-50">
              <span>Edit</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
            </div>

            <div>
              <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-4">Job Preferences</h3>
              <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Salary Requirement</span>
                  <div className="flex items-end gap-1">
                    <span className="text-2xl font-black text-slate-900 tracking-tight">₹{meData.preferences.desired_pay_inr_lpa.min}</span>
                    <span className="text-sm font-bold text-slate-500 pb-1">- {meData.preferences.desired_pay_inr_lpa.ideal} LPA</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Work Type</span>
                  <div className="flex gap-2 flex-wrap">
                    {meData.preferences.work_type.map(type => (
                      <span key={type} className="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-1 rounded-md text-xs font-bold">{type}</span>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Desired Roles</span>
                  <p className="text-sm font-medium text-slate-700 leading-snug">{meData.preferences.preferred_roles.join(", ")}</p>
                </div>
                
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Company Size</span>
                  <p className="text-sm font-medium text-slate-700">{meData.preferences.preferred_company_size.join(", ")}</p>
                </div>

              </div>
            </div>
          </div>

          {/* Tech Stack Bento */}
          <div className="glass p-6 rounded-2xl border border-slate-200 bg-[#FBFBFB] lg:col-span-3 space-y-6">
            <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400">Tech Stack & Skills</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {Object.entries(meData.skills).map(([category, skills]) => (
                <div key={category} className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-900 capitalize border-b border-slate-100 pb-2 mb-2">{category.replace('_', ' ')}</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {skills.map(skill => (
                      <span key={skill} className="bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded text-[11px] font-semibold">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Experience Details */}
          <div className="glass p-6 rounded-2xl border border-slate-200 bg-[#FBFBFB] lg:col-span-3 space-y-6">
            <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400">Experience</h3>
            <div className="space-y-6 border-l-2 border-slate-100 pl-4 ml-2">
              {meData.experience_details.map((exp, idx) => (
                <div key={idx} className="relative">
                  <div className="absolute -left-[23px] top-1.5 h-3 w-3 rounded-full bg-emerald-400 ring-4 ring-[#FBFBFB]" />
                  <div className="flex flex-col sm:flex-row sm:items-baseline justify-between mb-2">
                    <h4 className="text-base font-bold text-slate-900">{exp.role} <span className="text-slate-400 font-medium">at {exp.company}</span></h4>
                    <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-md">{exp.duration}</span>
                  </div>
                  <ul className="space-y-2">
                    {exp.bullets.map((bullet, i) => (
                      <li key={i} className="text-sm text-slate-600 font-medium leading-relaxed flex items-start gap-2">
                        <span className="text-emerald-500 font-bold mt-0.5">•</span>
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

        </section>
      </div>
    </div>
  );
}
