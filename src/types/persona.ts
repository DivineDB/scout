export interface ExperienceDetail {
  role: string;
  company: string;
  duration: string;
  bullets: string[];
}

export interface Persona {
  name: string;
  degree: string;
  graduation_year: number;
  summary: string;
  location: {
    city: string;
    state: string;
    country: string;
  };
  contact: {
    email: string;
    phone: string;
  };
  interests: string[];
  skills: {
    languages: string[];
    frameworks: string[];
    ui_ux: string[];
    ai_ml: string[];
    tools: string[];
    databases: string[];
  };
  experience_details: ExperienceDetail[];
  preferences: {
    preferred_roles: string[];
    work_type: string[];
    desired_pay_inr_lpa: {
      min: number;
      ideal: number;
    };
    preferred_company_size: string[];
    willing_to_relocate: boolean;
  };
  social: {
    github: string;
    linkedin: string;
    portfolio: string;
  };
}

export interface MorphedProfile {
  persona: Persona;
  target_job_title: string;
  top_keywords: string[];
  morphed_experience: ExperienceDetail[];
}
