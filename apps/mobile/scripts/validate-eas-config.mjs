/* global process */

const easProjectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;

if (
  typeof easProjectId !== 'string' ||
  easProjectId.trim().length === 0 ||
  easProjectId === 'YOUR_EAS_PROJECT_ID' ||
  easProjectId === 'your-eas-project-id-here'
) {
  console.error(
    '[EAS] Missing EXPO_PUBLIC_EAS_PROJECT_ID. Set a real EAS project ID before running mobile build.'
  );
  process.exit(1);
}

console.log('[EAS] EAS project ID is configured.');
