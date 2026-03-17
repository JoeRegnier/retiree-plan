#!/usr/bin/env node
/**
 * One-shot migration: MUI v6 Grid item API → MUI v7 Grid size API
 *
 * Before: <Grid item xs={12} sm={6} md={4}>
 * After:  <Grid size={{ xs: 12, sm: 6, md: 4 }}>
 *
 * Also handles:
 *   <Grid item xs={12}>      → <Grid size={{ xs: 12 }}>
 *   <Grid item>              → <Grid>
 *   <Grid item key={run.id} xs={12} md={6}> → <Grid size={{ xs: 12, md: 6 }} key={run.id}>
 */

const fs = require('fs');

const FILES = [
  'apps/web/src/pages/InternationalPage.tsx',
  'apps/web/src/pages/ScenariosPage.tsx',
  'apps/web/src/pages/SimulationsPage.tsx',
  'apps/web/src/pages/HouseholdPage.tsx',
  'apps/web/src/pages/AccountsPage.tsx',
  'apps/web/src/pages/DashboardPage.tsx',
  'apps/web/src/pages/ComparePage.tsx',
  'apps/web/src/pages/TaxAnalyticsPage.tsx',
  'apps/web/src/pages/EarliestRetirePage.tsx',
  'apps/web/src/pages/MilestonesPage.tsx',
  'apps/web/src/pages/EstatePage.tsx',
  'apps/web/src/pages/SettingsPage.tsx',
  'apps/web/src/pages/HelpPage.tsx',
  'apps/web/src/pages/GoalsPage.tsx',
  'apps/web/src/pages/ProjectionsPage.tsx',
  'apps/web/src/pages/OverviewPage.tsx',
];

const BREAKPOINTS = ['xs', 'sm', 'md', 'lg', 'xl'];

function migrateContent(content) {
  // Regex: matches <Grid followed by props that include "item"
  // All on a single line (which is the pattern in this codebase)
  return content.replace(/<Grid ([^>]+)>/g, function(match, propsStr) {
    // Only migrate if "item" prop is present
    if (!/\bitem\b/.test(propsStr)) {
      return match; // leave <Grid container ...> untouched
    }

    // Remove the standalone "item" prop
    let remaining = propsStr.replace(/\bitem\b\s*/g, '').trim();

    // Extract breakpoint props
    const sizeMap = {};
    for (const bp of BREAKPOINTS) {
      const re = new RegExp('\\b' + bp + '=\\{([^}]+)\\}\\s*');
      const m = remaining.match(re);
      if (m) {
        sizeMap[bp] = m[1];
        remaining = remaining.replace(re, '').trim();
      }
    }

    const sizeKeys = Object.keys(sizeMap);
    let sizeAttr = '';
    if (sizeKeys.length === 1) {
      sizeAttr = 'size={{ ' + sizeKeys[0] + ': ' + sizeMap[sizeKeys[0]] + ' }}';
    } else if (sizeKeys.length > 1) {
      const inner = sizeKeys.map(function(k) { return k + ': ' + sizeMap[k]; }).join(', ');
      sizeAttr = 'size={{ ' + inner + ' }}';
    }

    const parts = [];
    if (sizeAttr) parts.push(sizeAttr);
    if (remaining) parts.push(remaining);

    if (parts.length === 0) {
      return '<Grid>';
    }
    return '<Grid ' + parts.join(' ') + '>';
  });
}

let totalFiles = 0;
let totalMatches = 0;

for (const file of FILES) {
  try {
    const original = fs.readFileSync(file, 'utf8');
    const migrated = migrateContent(original);
    if (original !== migrated) {
      fs.writeFileSync(file, migrated, 'utf8');
      const count = (original.match(/<Grid [^>]*\bitem\b/g) || []).length;
      console.log('Migrated: ' + file + ' (' + count + ' items)');
      totalFiles++;
      totalMatches += count;
    } else {
      console.log('No changes: ' + file);
    }
  } catch (e) {
    console.error('ERROR: ' + file + ': ' + e.message);
  }
}

console.log('\nDone: ' + totalFiles + ' files, ' + totalMatches + ' Grid items migrated to MUI v7 size API');
