<?php
declare(strict_types=1);

namespace Composer {
    final class InstalledVersions
    {
        public static function getInstallPath(string $packageName): ?string
        {
            if ($packageName !== "phaseo/sdk") {
                return null;
            }

            return dirname(__DIR__, 2) . "/sdk-php";
        }
    }
}

namespace {
    require_once __DIR__ . "/../src/AgentSdk.php";

    if (!class_exists(\Phaseo\Sdk\Phaseo::class)) {
        throw new \RuntimeException("Composer-installed Phaseo SDK was not loaded");
    }

    if (!class_exists(\Phaseo\AgentSdk\AgentSdk::class)) {
        throw new \RuntimeException("Phaseo Agent SDK was not loaded");
    }

    echo "php agent sdk composer install test ok\n";
}
