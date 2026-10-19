'use strict';

const GhostAdminAPI = require('@tryghost/admin-api');
const fs = require('fs');
const path = require('path');

let api = null;
let dryRun = false;
let ghostUrl = '';

function init(options = {}) {
  dryRun = options.dryRun || false;
  ghostUrl = process.env.GHOST_URL;

  if (!dryRun) {
    if (!ghostUrl) throw new Error('GHOST_URL environment variable is required');
    if (!process.env.GHOST_ADMIN_KEY) throw new Error('GHOST_ADMIN_KEY environment variable is required');
    api = new GhostAdminAPI({
      url: ghostUrl,
      key: process.env.GHOST_ADMIN_KEY,
      version: 'v5.0',
    });
  }
}

function adminUrl(type, slug) {
  const base = ghostUrl.replace(/\/$/, '');
  if (type === 'post') return `${base}/ghost/#/editor/post/${slug}`;
  if (type === 'page') return `${base}/ghost/#/editor/page/${slug}`;
  if (type === 'tag') return `${base}/ghost/#/tags/${slug}`;
  return base;
}

async function findBySlug(type, slug) {
  if (dryRun) return null;
  try {
    const resource = type === 'tag' ? api.tags : api[`${type}s`];
    const filter = { filter: `slug:${slug}` };
    if (type !== 'tag') filter.status = 'all';
    const results = await resource.browse(filter);
    return results[0] || null;
  } catch (err) {
    if (err.type === 'NotFoundError') return null;
    throw err;
  }
}

async function uploadImage(filePath) {
  if (dryRun) {
    console.log(`  [DRY RUN] Would upload image: ${filePath}`);
    return `https://example.com/content/images/${path.basename(filePath)}`;
  }
  if (!fs.existsSync(filePath)) {
    console.log(`  [SKIP] Image not found: ${filePath}`);
    return null;
  }
  const result = await api.images.upload({ file: filePath });
  console.log(`  Uploaded image: ${result.url}`);
  return result.url;
}

async function ensureTag(tagData) {
  const { name, slug, description } = tagData;
  console.log(`Tag: ${name} (${slug})`);

  if (dryRun) {
    console.log(`  [DRY RUN] Would create/update tag: ${name}`);
    return { id: `dry-run-tag-${slug}`, slug, name };
  }

  const existing = await findBySlug('tag', slug);
  if (existing) {
    console.log(`  EXISTS — ${adminUrl('tag', slug)}`);
    return existing;
  }

  const tag = await api.tags.add({ name, slug, description });
  console.log(`  CREATED — ${adminUrl('tag', tag.slug)}`);
  return tag;
}

function htmlToLexical(html) {
  return JSON.stringify({
    root: {
      children: [
        {
          type: 'html',
          version: 1,
          html,
        },
      ],
      direction: null,
      format: '',
      indent: 0,
      type: 'root',
      version: 1,
    },
  });
}

async function ensureContent(type, data) {
  const { title, slug, html, meta_title, meta_description, feature_image, tags, status } = data;
  const label = type === 'page' ? 'Page' : 'Post';
  console.log(`${label}: ${title} (${slug})`);

  if (dryRun) {
    console.log(`  [DRY RUN] Would create/update ${label.toLowerCase()}: ${title}`);
    console.log(`  Tags: ${(tags || []).map(t => t.name || t).join(', ')}`);
    return { slug };
  }

  const existing = await findBySlug(type, slug);
  const payload = {
    title,
    slug,
    lexical: htmlToLexical(html),
    status: status || 'draft',
    meta_title: meta_title || title,
    meta_description,
    feature_image,
    tags,
  };

  const resource = api[`${type}s`];

  if (existing) {
    payload.updated_at = existing.updated_at;
    const result = await resource.edit({ ...payload, id: existing.id });
    console.log(`  UPDATED — ${adminUrl(type, result.slug)}`);
    return result;
  }

  const result = await resource.add(payload);
  console.log(`  CREATED — ${adminUrl(type, result.slug)}`);
  return result;
}

function ensurePage(pageData) {
  return ensureContent('page', pageData);
}

async function deletePage(slug) {
  if (dryRun) {
    console.log(`  [DRY RUN] Would delete page: ${slug}`);
    return;
  }
  const existing = await findBySlug('page', slug);
  if (!existing) {
    console.log(`  [SKIP] ${slug} — not found`);
    return;
  }
  await api.pages.delete({ id: existing.id });
  console.log(`  [DELETED] ${slug}`);
}

module.exports = { init, ensureTag, ensurePage, uploadImage, deletePage, adminUrl };
