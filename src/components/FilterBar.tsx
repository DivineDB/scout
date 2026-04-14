"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown, Sliders } from "lucide-react";
import meData from "@/data/me.json";

// ─── Types ────────────────────────────────────────────────────────────────────
interface FilterState {
  roles: string[];
  location: string[];
  salaryMin: number;
  skills: string[];
}

const ROLES = ["Design Engineer", "Full-stack", "Frontend", "AI Engineer"] as const;
const LOCATIONS = ["Remote", "Hybrid", "On-site"] as const;
const SALARY_MIN = 8;
const SALARY_MAX = 40;
const SALARY_DEFAULT = 12;

// Flatten all skills from me.json into a single list
const ALL_SKILLS: string[] = Object.values(meData.skills).flat();

// ─── Debounce Hook ────────────────────────────────────────────────────────────
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debouncedValue;
}

// ─── Sync to Profile ──────────────────────────────────────────────────────────
async function patchProfile(filters: FilterState) {
  try {
    await fetch("/api/profile/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        preferred_roles: filters.roles,
        preferred_location: filters.location,
        salary_min: filters.salaryMin,
        salary_ideal: Math.round(filters.salaryMin * 2),
      }),
    });
  } catch (err) {
    console.warn("[FilterBar] Profile sync failed:", err);
  }
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function RoleBadge({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all duration-200"
      style={{
        background: active ? "rgba(0,255,194,0.12)" : "rgba(255,255,255,0.04)",
        border: `1px solid ${active ? "rgba(0,255,194,0.35)" : "rgba(255,255,255,0.08)"}`,
        color: active ? "#00FFC2" : "#71717A",
        boxShadow: active ? "0 0 8px rgba(0,255,194,0.15)" : "none",
      }}
    >
      {active && (
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: "#00FFC2" }}
        />
      )}
      {label}
    </button>
  );
}

function LocationButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1 text-xs font-semibold transition-all duration-200 first:rounded-l-full last:rounded-r-full"
      style={{
        background: active ? "rgba(0,255,194,0.12)" : "transparent",
        color: active ? "#00FFC2" : "#52525B",
        borderTop: "1px solid rgba(255,255,255,0.08)",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        borderLeft: "1px solid rgba(255,255,255,0.08)",
        borderRight: "0",
      }}
    >
      {label}
    </button>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export function FilterBar() {
  const [filters, setFilters] = useState<FilterState>({
    roles: ["Design Engineer", "Full-stack", "Frontend"],
    location: ["Remote"],
    salaryMin: SALARY_DEFAULT,
    skills: ALL_SKILLS.slice(0, 6),
  });
  const [hasSynced, setHasSynced] = useState(false);
  const isFirstSync = useRef(true);

  // Load existing profile on mount
  useEffect(() => {
    fetch("/api/profile/update")
      .then((r) => r.json())
      .then(({ profile }) => {
        if (!profile) return;
        setFilters((prev) => ({
          roles:
            profile.preferred_roles?.length > 0
              ? profile.preferred_roles
              : prev.roles,
          location:
            profile.preferred_location?.length > 0
              ? profile.preferred_location
              : prev.location,
          salaryMin: profile.salary_min ?? prev.salaryMin,
          skills: prev.skills,
        }));
      })
      .catch(() => {});
  }, []);

  // Debounced sync
  const debouncedFilters = useDebounce(filters, 800);

  useEffect(() => {
    if (isFirstSync.current) {
      isFirstSync.current = false;
      return;
    }
    patchProfile(debouncedFilters).then(() => {
      setHasSynced(true);
      setTimeout(() => setHasSynced(false), 2000);
    });
  }, [debouncedFilters]);

  const toggleRole = useCallback((role: string) => {
    setFilters((f) => ({
      ...f,
      roles: f.roles.includes(role)
        ? f.roles.filter((r) => r !== role)
        : [...f.roles, role],
    }));
  }, []);

  const toggleLocation = useCallback((loc: string) => {
    setFilters((f) => ({
      ...f,
      location: f.location.includes(loc)
        ? f.location.filter((l) => l !== loc)
        : [...f.location, loc],
    }));
  }, []);

  const toggleSkill = useCallback((skill: string) => {
    setFilters((f) => ({
      ...f,
      skills: f.skills.includes(skill)
        ? f.skills.filter((s) => s !== skill)
        : [...f.skills, skill],
    }));
  }, []);

  return (
    <div
      className="sticky top-0 z-30 w-full"
      style={{
        background: "rgba(5,5,5,0.85)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
      }}
    >
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-3 px-6 py-3 md:px-10">

        {/* ── Role Pills ──────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-1.5">
          {ROLES.map((role) => (
            <RoleBadge
              key={role}
              label={role}
              active={filters.roles.includes(role)}
              onClick={() => toggleRole(role)}
            />
          ))}
        </div>

        <div
          className="hidden h-4 w-px md:block"
          style={{ background: "rgba(255,255,255,0.08)" }}
        />

        {/* ── Location Segmented Control ──────────────────────── */}
        <div
          className="flex overflow-hidden rounded-full"
          style={{ border: "1px solid rgba(255,255,255,0.08)" }}
        >
          {LOCATIONS.map((loc) => (
            <LocationButton
              key={loc}
              label={loc}
              active={filters.location.includes(loc)}
              onClick={() => toggleLocation(loc)}
            />
          ))}
          {/* last item right border */}
          <button
            onClick={() => toggleLocation(LOCATIONS[LOCATIONS.length - 1])}
            className="hidden"
            style={{ borderRight: "1px solid rgba(255,255,255,0.08)" }}
          />
        </div>

        <div
          className="hidden h-4 w-px md:block"
          style={{ background: "rgba(255,255,255,0.08)" }}
        />

        {/* ── Salary Slider ───────────────────────────────────── */}
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-semibold" style={{ color: "#52525B" }}>
            ₹
          </span>
          <input
            type="range"
            min={SALARY_MIN}
            max={SALARY_MAX}
            step={1}
            value={filters.salaryMin}
            onChange={(e) =>
              setFilters((f) => ({ ...f, salaryMin: parseInt(e.target.value) }))
            }
            className="salary-slider h-1 w-28 cursor-pointer appearance-none rounded-full outline-none"
            style={{
              background: `linear-gradient(to right, #00FFC2 0%, #00FFC2 ${
                ((filters.salaryMin - SALARY_MIN) / (SALARY_MAX - SALARY_MIN)) * 100
              }%, rgba(255,255,255,0.1) ${
                ((filters.salaryMin - SALARY_MIN) / (SALARY_MAX - SALARY_MIN)) * 100
              }%, rgba(255,255,255,0.1) 100%)`,
            }}
          />
          <span className="min-w-[36px] text-xs font-bold" style={{ color: "#00FFC2" }}>
            {filters.salaryMin}L+
          </span>
        </div>

        <div
          className="hidden h-4 w-px md:block"
          style={{ background: "rgba(255,255,255,0.08)" }}
        />

        {/* ── Tech Arsenal Popover ────────────────────────────── */}
        <Popover>
          <PopoverTrigger>
            <button
              className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all duration-200"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "#71717A",
              }}
            >
              <Sliders className="h-3 w-3" />
              Stack
              <ChevronDown className="h-3 w-3" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            side="bottom"
            align="end"
            sideOffset={8}
            className="z-[9999] w-80 p-4"
            style={{
              background: "#0E0E0E",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "12px",
              boxShadow: "0 20px 60px rgba(0,0,0,0.8)",
            }}
          >
            <p
              className="mb-3 text-[10px] font-bold uppercase tracking-widest"
              style={{ color: "#52525B" }}
            >
              Tech Arsenal
            </p>
            <div className="flex flex-wrap gap-1.5">
              {ALL_SKILLS.map((skill) => {
                const active = filters.skills.includes(skill);
                return (
                  <button
                    key={skill}
                    onClick={() => toggleSkill(skill)}
                    className="rounded-md px-2.5 py-1 text-xs font-medium transition-all duration-150"
                    style={{
                      background: active
                        ? "rgba(0,255,194,0.1)"
                        : "rgba(255,255,255,0.04)",
                      border: `1px solid ${
                        active
                          ? "rgba(0,255,194,0.3)"
                          : "rgba(255,255,255,0.07)"
                      }`,
                      color: active ? "#00FFC2" : "#52525B",
                    }}
                  >
                    {skill}
                  </button>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>

        {/* ── Sync indicator ─────────────────────────────────── */}
        <div className="ml-auto flex items-center gap-1.5">
          {hasSynced && (
            <span
              className="text-[10px] font-medium"
              style={{ color: "#00FFC2" }}
            >
              ✓ Ghost updated
            </span>
          )}
          <span
            className="text-[10px] font-medium"
            style={{ color: "#3F3F46" }}
          >
            syncs to next sweep
          </span>
        </div>
      </div>

      {/* Slider thumb CSS */}
      <style>{`
        .salary-slider::-webkit-slider-thumb {
          appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #00FFC2;
          cursor: pointer;
          box-shadow: 0 0 6px rgba(0,255,194,0.5);
          border: 2px solid #050505;
        }
        .salary-slider::-moz-range-thumb {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #00FFC2;
          cursor: pointer;
          border: 2px solid #050505;
        }
      `}</style>
    </div>
  );
}
