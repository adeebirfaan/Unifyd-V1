const fs = require('node:fs/promises');
const path = require('node:path');
const { AndroidConfig, withAndroidManifest, withDangerousMod } = require('expo/config-plugins');

// expo-notifications 57 supports a small icon in its config plugin, but reads
// this manifest resource for a local notification's large icon.
const METADATA_KEY = 'expo.modules.notifications.large_notification_icon';
const DRAWABLE_NAME = 'unifyd_notification_large_icon';

module.exports = function withUnifydNotificationLargeIcon(config, { largeIcon }) {
  config = withAndroidManifest(config, (mod) => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(mod.modResults);
    AndroidConfig.Manifest.addMetaDataItemToMainApplication(
      application,
      METADATA_KEY,
      `@drawable/${DRAWABLE_NAME}`,
      'resource'
    );
    return mod;
  });

  return withDangerousMod(config, ['android', async (mod) => {
    const source = path.resolve(mod.modRequest.projectRoot, largeIcon);
    const destination = path.join(
      mod.modRequest.platformProjectRoot,
      'app', 'src', 'main', 'res', 'drawable-nodpi', `${DRAWABLE_NAME}.png`
    );
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.copyFile(source, destination);
    return mod;
  }]);
};
