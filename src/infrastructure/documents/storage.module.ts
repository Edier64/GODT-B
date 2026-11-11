import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { FILE_STORAGE_PORT } from "../../application/documents/file-storage.port";
import type { AzureBlobStorageAdapter } from "./azure-blob-storage.adapter";
import { LocalPrivateStorageAdapter } from "./local-private-storage.adapter";
import type { R2StorageAdapter } from "./r2-storage.adapter";

@Module({
  imports: [ConfigModule],
  providers: [
    LocalPrivateStorageAdapter,
    {
      provide: FILE_STORAGE_PORT,
      inject: [ConfigService, LocalPrivateStorageAdapter],
      useFactory: (
        config: ConfigService,
        local: LocalPrivateStorageAdapter,
      ) => {
        const provider = (
          config.get<string>("STORAGE_PROVIDER", "local") || "local"
        )
          .trim()
          .toLowerCase();

        if (provider === "azure") {
          const {
            AzureBlobStorageAdapter: Adapter,
          } = require("./azure-blob-storage.adapter") as {
            AzureBlobStorageAdapter: typeof AzureBlobStorageAdapter;
          };
          return new Adapter(config);
        }
        if (provider === "r2" || provider === "s3") {
          const {
            R2StorageAdapter: Adapter,
          } = require("./r2-storage.adapter") as {
            R2StorageAdapter: typeof R2StorageAdapter;
          };
          return new Adapter(config);
        }
        return local;
      },
    },
  ],
  exports: [FILE_STORAGE_PORT, LocalPrivateStorageAdapter],
})
export class StorageModule {}
