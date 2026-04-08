async function applyMigrations() {
  // Intentionally no-op for demo flow.
  // Schema-dependent changes are avoided in app code (pdf_url is persisted in form_data).
  console.log('No remote DB patch required.');
}

applyMigrations().catch(error => {
  console.error('Migration failed:', error);
  process.exit(1);
});
