import { getSettings } from './actions';
import SettingsForm from './SettingsForm';

export default async function SettingsPage() {
  const settings = await getSettings();

  if (!settings) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <h2 className="text-lg font-semibold text-red-800 mb-2">Error Loading Settings</h2>
        <p className="text-red-600">
          Failed to load settings. Please check your database connection and ensure migrations have been run.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="mt-2 text-sm text-gray-600">
          Manage your application settings and configuration.
        </p>
      </div>
      <SettingsForm initialSettings={settings} />
    </div>
  );
}
