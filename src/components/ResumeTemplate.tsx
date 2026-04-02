import React from 'react';
import { Page, Text, View, Document, StyleSheet, Font } from '@react-pdf/renderer';
import { MorphedProfile } from '@/types/persona';

Font.register({
  family: 'Inter',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZJhjp-Ek-_EeA.woff' },
    { src: 'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuI6fAZJhjp-Ek-_EeA.woff', fontWeight: 'bold' },
    { src: 'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZJhjp-Ek-_EeA.woff', fontStyle: 'italic' },
  ]
});

const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#FFFFFF',
    padding: 40,
    fontFamily: 'Inter',
  },
  header: {
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    paddingBottom: 10,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  contact: {
    fontSize: 10,
    color: '#333333',
    marginBottom: 3,
  },
  jobContext: {
    fontSize: 10,
    marginTop: 8,
    fontStyle: 'italic',
    color: '#555555',
  },
  sectionTitle: {
    fontSize: 13,
    marginTop: 15,
    marginBottom: 8,
    textTransform: 'uppercase',
    fontWeight: 'bold',
    borderBottomWidth: 0.5,
    borderBottomColor: '#CCCCCC',
    paddingBottom: 2,
  },
  experienceItem: {
    marginBottom: 12,
  },
  roleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  roleText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  durationText: {
    fontSize: 10,
    color: '#555555',
  },
  companyText: {
    fontSize: 10,
    marginBottom: 4,
    fontStyle: 'italic',
  },
  bulletItem: {
    flexDirection: 'row',
    marginBottom: 3,
    paddingLeft: 5,
  },
  bulletPoint: {
    width: 10,
    fontSize: 10,
  },
  bulletText: {
    flex: 1,
    fontSize: 10,
    lineHeight: 1.4,
  },
  skillsSection: {
    marginTop: 5,
  },
  skillText: {
    fontSize: 10,
    lineHeight: 1.6,
  },
  skillLabel: {
    fontWeight: 'bold',
  }
});

export const ResumeTemplate = ({ profile }: { profile: MorphedProfile }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.name}>{profile.persona.name}</Text>
        <Text style={styles.contact}>
          {profile.persona.location.city}, {profile.persona.location.state} | {profile.persona.contact.email} | {profile.persona.contact.phone}
        </Text>
        <Text style={styles.contact}>
          LinkedIn: {profile.persona.social.linkedin} | GitHub: {profile.persona.social.github}
        </Text>
        <Text style={styles.jobContext}>
          Tailored for: {profile.target_job_title}
        </Text>
      </View>

      <View>
        <Text style={styles.sectionTitle}>Experience</Text>
        {profile.morphed_experience.map((exp, idx) => (
          <View key={idx} style={styles.experienceItem}>
            <View style={styles.roleHeader}>
              <Text style={styles.roleText}>{exp.role}</Text>
              <Text style={styles.durationText}>{exp.duration}</Text>
            </View>
            <Text style={styles.companyText}>{exp.company}</Text>
            {exp.bullets.map((bullet, bIdx) => (
              <View key={bIdx} style={styles.bulletItem}>
                <Text style={styles.bulletPoint}>•</Text>
                <Text style={styles.bulletText}>{bullet}</Text>
              </View>
            ))}
          </View>
        ))}
      </View>

      <View style={styles.skillsSection}>
        <Text style={styles.sectionTitle}>Technical Skills</Text>
        <Text style={styles.skillText}>
          <Text style={styles.skillLabel}>Languages: </Text>{profile.persona.skills.languages.join(', ')}
        </Text>
        <Text style={styles.skillText}>
          <Text style={styles.skillLabel}>Frameworks: </Text>{profile.persona.skills.frameworks.join(', ')}
        </Text>
        <Text style={styles.skillText}>
          <Text style={styles.skillLabel}>Databases / Tools: </Text>{[...profile.persona.skills.databases, ...profile.persona.skills.tools].join(', ')}
        </Text>
        <Text style={styles.skillText}>
          <Text style={styles.skillLabel}>Top Matches for Role: </Text>{profile.top_keywords.join(', ')}
        </Text>
      </View>

      <View style={styles.skillsSection}>
        <Text style={styles.sectionTitle}>Education</Text>
        <View style={styles.roleHeader}>
          <Text style={styles.roleText}>{profile.persona.degree}</Text>
          <Text style={styles.durationText}>Class of {profile.persona.graduation_year}</Text>
        </View>
        <Text style={styles.companyText}>Gwalior, Madhya Pradesh</Text>
      </View>
    </Page>
  </Document>
);
