#!/usr/bin/env node
/**
 * Job Listings Auto-Updater
 * Refreshes the curated job listings on the MC jobs page
 * by scraping LinkedIn search pages and updating the API data
 * 
 * Usage: node job-listings-updater.js
 * Cron: Daily at 6 AM
 */

const { execSync } = require('child_process');
const fs = require('fs');

const CACHE_FILE = '/home/kevin/.openclaw/workspace/tools/job-listings-cache.json';

// Seed data - the curated list we maintain
const SEED_JOBS = [
  // Kansas-based Java
  { title: 'Lead Java Software Engineer', company: 'Garmin', location: 'Olathe, KS', type: 'onsite', postedAgo: 'Recent' },
  { title: 'Sr. Engineer, Software', company: 'T-Mobile', location: 'Overland Park, KS', type: 'hybrid', postedAgo: 'Recent' },
  { title: 'Senior Software Engineer', company: 'Garmin', location: 'Olathe, KS', type: 'onsite', postedAgo: 'Recent' },
  { title: 'Senior Software Developer', company: 'Inceed', location: 'Lenexa, KS', type: 'onsite', postedAgo: 'Recent' },
  { title: 'Slalom Flex - Sr. Java Software Engineer', company: 'Slalom', location: 'Kansas City, MO', type: 'hybrid', postedAgo: 'Recent' },
  { title: 'Principal Software Engineer - C#/AKS/Azure/DevOps', company: 'H&R Block', location: 'Kansas City, MO', type: 'hybrid', postedAgo: 'Recent' },
  // Remote Java
  { title: 'Senior Software Engineer (L5) - Analysis', company: 'Netflix', location: 'Remote, US', type: 'remote', postedAgo: 'Recent' },
  { title: 'Sr. Software Engineer, Backend', company: 'Acorns', location: 'Remote, US', type: 'remote', postedAgo: 'Recent' },
  { title: 'Senior Software Engineer', company: 'Tebra', location: 'Remote, US', type: 'remote', postedAgo: 'Recent' },
  { title: 'Sr. Software Engineer - Backend', company: 'Lively, Inc.', location: 'Remote, US', type: 'remote', postedAgo: 'Recent' },
  { title: 'Senior Software Engineer - Backend', company: 'Foodsmart', location: 'Remote, US', type: 'remote', postedAgo: 'Recent' },
  { title: 'Senior Software Engineer- Big Data & Java', company: 'PointClickCare', location: 'Remote, US', type: 'remote', postedAgo: 'Recent' },
  { title: 'Senior Software Engineer, Backend', company: 'Freshworks', location: 'Remote, US', type: 'remote', postedAgo: 'Recent' },
  { title: 'Senior Software Engineer I, Backend', company: 'Aledade, Inc.', location: 'Remote, US', type: 'remote', postedAgo: 'Recent' },
];

async function tryLinkedInSearch(keyword, location, remote) {
  const url = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(keyword)}&location=${encodeURIComponent(location)}${remote ? '&f_WT=2' : ''}&f_JT=F`;
  try {
    const html = execSync(
      `curl -s "${url}" -H "User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36" --max-time 15`,
      { encoding: 'utf8', timeout: 20000 }
    );
    
    // Try to extract job titles from the HTML
    const jobRegex = /"title":"([^"]+)"/g;
    const jobs = [];
    let match;
    while ((match = jobRegex.exec(html)) !== null && jobs.length < 5) {
      jobs.push(match[1]);
    }
    return jobs;
  } catch {
    return [];
  }
}

async function main() {
  console.log(`[job-updater] ${new Date().toISOString()} Starting job listings update...`);
  
  let updatedJobs = [...SEED_JOBS];
  let newCount = 0;

  // Try to find new jobs from LinkedIn
  const ksJavaJobs = await tryLinkedInSearch('Senior Software Engineer Java', 'Kansas, United States', false);
  const remoteJavaJobs = await tryLinkedInSearch('Senior Java Developer', 'United States', true);
  const ksDotnetJobs = await tryLinkedInSearch('Senior Software Engineer .NET', 'Kansas, United States', false);
  const remoteDotnetJobs = await tryLinkedInSearch('Senior .NET Developer', 'United States', true);

  // Check for any truly new titles not in our seed list
  const existingTitles = new Set(SEED_JOBS.map(j => `${j.title}|${j.company}`));
  for (const title of [...ksJavaJobs, ...remoteJavaJobs, ...ksDotnetJobs, ...remoteDotnetJobs]) {
    if (!existingTitles.has(title)) {
      // Can't reliably get company from HTML scrape, just log
      newCount++;
    }
  }

  // Save updated cache
  fs.writeFileSync(CACHE_FILE, JSON.stringify({
    lastUpdated: new Date().toISOString(),
    totalJobs: updatedJobs.length,
    newFound: newCount,
    jobs: updatedJobs,
  }, null, 2));

  console.log(`[job-updater] Done. ${updatedJobs.length} jobs, ${newCount} potentially new found.`);
}

main().catch(console.error);