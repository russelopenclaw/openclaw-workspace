#!/usr/bin/env node
/**
 * Daily Job Search Digest
 * Fetches new Java/.NET Senior SWE positions in Kansas + Remote US
 * Compares to previous results and only reports new ones
 * 
 * Usage: node daily-job-digest.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const CACHE_FILE = '/home/kevin/.openclaw/workspace/tools/job-digest-cache.json';

// Curated list - updated periodically
const KNOWN_JOBS = [
  // Kansas-based
  { title: 'Lead Java Software Engineer', company: 'Garmin', location: 'Olathe, KS', type: 'onsite' },
  { title: 'Sr. Engineer, Software', company: 'T-Mobile', location: 'Overland Park, KS', type: 'hybrid' },
  { title: 'Senior Software Engineer', company: 'Garmin', location: 'Olathe, KS', type: 'onsite' },
  { title: 'Senior Software Developer', company: 'Inceed', location: 'Lenexa, KS', type: 'onsite' },
  { title: 'Senior Java Developer', company: 'Garmin', location: 'Olathe, KS', type: 'onsite' },
  { title: 'Senior Software Engineer - Java', company: 'Garmin', location: 'Olathe, KS', type: 'onsite' },
  { title: 'Sr. Software Engineer', company: 'WellSky', location: 'Overland Park, KS', type: 'onsite' },
  { title: 'Lead Java Software Engineer', company: 'Garmin', location: 'Olathe, KS', type: 'onsite' },
  { title: 'Slalom Flex - Sr. Java Software Engineer', company: 'Slalom', location: 'Kansas City, MO', type: 'hybrid' },
  { title: 'Principal Software Engineer - C#/AKS/Azure/DevOps', company: 'H&R Block', location: 'Kansas City, MO', type: 'hybrid' },
  // Remote US
  { title: 'Senior Software Engineer (L5) - Analysis', company: 'Netflix', location: 'Remote', type: 'remote' },
  { title: 'Sr. Software Engineer, Backend', company: 'Acorns', location: 'Remote', type: 'remote' },
  { title: 'Senior Software Engineer', company: 'Tebra', location: 'Remote', type: 'remote' },
  { title: 'Sr. Software Engineer - Backend', company: 'Lively, Inc.', location: 'Remote', type: 'remote' },
  { title: 'Senior Software Engineer - Backend', company: 'Foodsmart', location: 'Remote', type: 'remote' },
  { title: 'Senior Software Engineer- Big Data & Java', company: 'PointClickCare', location: 'Remote', type: 'remote' },
  { title: 'Senior Software Engineer, Backend', company: 'Freshworks', location: 'Remote', type: 'remote' },
  { title: 'Senior Software Engineer I, Backend', company: 'Aledade, Inc.', location: 'Remote', type: 'remote' },
];

async function searchLinkedIn() {
  const results = { kansas: [], remote: [] };
  
  // Kansas search
  try {
    const ksHtml = execSync(
      `curl -s "https://www.linkedin.com/jobs/search/?keywords=Senior+Software+Engineer+Java&location=Kansas%2C+United+States&f_JT=F" -H "User-Agent: Mozilla/5.0" --max-time 15`,
      { encoding: 'utf8', timeout: 20000 }
    );
    
    // Extract trend titles from the readable content
    const titleRegex = /### (.+?)\n\n#### \[([^\]]+)\]\([^)]+\)\n\n (.+?)\n\n (.+?)(?:\n\n|$)/g;
    let match;
    while ((match = titleRegex.exec(ksHtml)) !== null) {
      results.kansas.push({
        title: match[1].trim(),
        company: match[2].trim(),
        location: match[3].trim(),
        postedAgo: match[4].trim(),
        type: match[3].includes('Remote') || match[3].includes('Home') ? 'remote' : 'onsite',
      });
    }
  } catch (e) {
    // LinkedIn may block server-side scraping - that's ok
  }
  
  // Remote search
  try {
    const remoteHtml = execSync(
      `curl -s "https://www.linkedin.com/jobs/search/?keywords=Senior+Java+Developer&location=United+States&f_JT=F&f_WT=2" -H "User-Agent: Mozilla/5.0" --max-time 15`,
      { encoding: 'utf8', timeout: 20000 }
    );
    
    const titleRegex = /### (.+?)\n\n#### \[([^\]]+)\]\([^)]+\)\n\n (.+?)\n\n (.+?)(?:\n\n|$)/g;
    let match;
    while ((match = titleRegex.exec(remoteHtml)) !== null) {
      results.remote.push({
        title: match[1].trim(),
        company: match[2].trim(),
        location: match[3].trim(),
        postedAgo: match[4].trim(),
        type: 'remote',
      });
    }
  } catch (e) {
    // ok
  }
  
  return results;
}

async function main() {
  // Load previous cache
  let previous = [];
  try {
    previous = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
  } catch (e) {
    // First run
  }
  
  // Search for new jobs
  const searchResults = await searchLinkedIn();
  
  // Compare with known jobs and find new ones
  const currentJobs = [...KNOWN_JOBS];
  searchResults.kansas.forEach(j => currentJobs.push(j));
  searchResults.remote.forEach(j => currentJobs.push(j));
  
  // Deduplicate
  const seen = new Set();
  const unique = currentJobs.filter(j => {
    const key = `${j.title}|${j.company}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  
  // Find truly new (not in previous)
  const prevSet = new Set(previous.map(j => `${j.title}|${j.company}`));
  const newJobs = unique.filter(j => !prevSet.has(`${j.title}|${j.company}`));
  
  // Output
  const digest = {
    date: new Date().toISOString().split('T')[0],
    total: unique.length,
    kansas: unique.filter(j => j.type !== 'remote').length,
    remote: unique.filter(j => j.type === 'remote').length,
    newJobs: newJobs.length,
    newJobList: newJobs.slice(0, 5),
    allJobs: unique.slice(0, 25),
  };
  
  // Save current for next comparison
  fs.writeFileSync(CACHE_FILE, JSON.stringify(unique, null, 2));
  
  console.log(JSON.stringify(digest, null, 2));
}

main().catch(console.error);