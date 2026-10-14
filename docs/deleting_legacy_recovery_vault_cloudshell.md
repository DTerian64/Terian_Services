# Delete the legacy Recovery Services vault from PowerShell Cloud Shell

Prepared October 13, 2026. Not executed against Azure by Codex.

David requested a Cloud Shell adaptation of Azure's generated
`C:/Temp/Delete_vault-m8qbevi0.ps1` after `hub-spoke-demo` deletion failed.
The original file is unchanged. The adapted file is
`scripts/delete-legacy-recovery-vault-cloudshell.ps1`.

The only selected vault is:

`/subscriptions/4ddf12bb-5397-445f-bcaa-df4c7d3dfdca/resourceGroups/hub-spoke-demo/providers/Microsoft.RecoveryServices/vaults/vault-m8qbevi0`

## Cloud Shell ASR initialization correction

David's first run stopped at `Set-AzRecoveryServicesAsrVaultContext` with
`Object reference not set to an instance of an object`, ClientRequestId
`2722f7e3-33d2-44ae-ac4b-ba99e3409064-2026-10-13 20:19:37Z-Ps`.
This occurred before any resource/backup deletion. The underlying provider/module
cause is not established. The updated file no longer initializes ASR context;
instead it reads the vault's `replicationFabrics` using the documented REST GET.
A successful empty array proves an empty fabric inventory; HTTP failures,
malformed results, unexpected IDs and incomplete pagination stop the run rather
than bypassing the ASR dependency check. Re-upload the updated file and rerun
preview before execution. Vault/group deletion is still unconfirmed.

## What changed

- Use Cloud Shell's existing PowerShell 7/Az sign-in. No interactive login,
  module uninstall/install, execution-policy change or manual bearer token.
- Select the exact legacy subscription ID, not its display name. Require tenant
  `5979eb86-9af1-4c74-8e50-acbe7d6a5cf9` and verify the returned vault ID.
- Default to an Azure-read-only inventory. Execution requires the exact vault ID
  as confirmation; it deletes all listed cloud backup data/recovery points and
  unregisters reviewed SQL/SAP/storage containers. This is not merely deleting
  an empty resource-group shell. No new backup is made.
- Disable SQL auto-protection before deleting SQL backup items. Wait for returned
  backup jobs and stop on failures. Skip items already marked `ToBeDeleted`.
- Preserve soft delete, immutability, hybrid security, resource guards/MUA and
  locks. No undelete-and-purge, retention shortening or protection bypass.
- Stop before writes if ASR fabrics, private endpoints, on-premises backup
  registrations, unknown workload containers, or detected target-subscription
  data-source IDs exist. Unlike the original, do not guess endpoint names or
  automatically dismantle disaster recovery. Missing optional source-ID fields
  do not prove that a backup has no external dependency; review the preview.
- Recheck dependencies before vault deletion. The provider can still reject
  deletion due to retention/security or dependencies not listed by these cmdlets.
  Active-vault omission is verified with bounded polling; it does not establish
  permanent purge or absence of a retained soft-deleted vault.

## Run in Cloud Shell

1. Sign in to Azure as `david.admin@terianix.onmicrosoft.com` and use the
   **Terianix Platform** directory, not the retained Terian Services Inc. tenant.
2. Open Cloud Shell and select **PowerShell**. Use **Manage files > Upload** to
   upload the adapted `.ps1` from the local `scripts` folder. It normally lands
   in your Cloud Shell home directory; uploaded names are case sensitive.
3. From that directory, run the read-only preview:

```powershell
./delete-legacy-recovery-vault-cloudshell.ps1
```

Check all listed backup items, registered containers and held dependencies.
If any backup data is still needed or protects the new platform, stop.

4. To approve deletion of the listed cloud backup data and this vault, run:

```powershell
./delete-legacy-recovery-vault-cloudshell.ps1 -Execute -ConfirmVaultId '/subscriptions/4ddf12bb-5397-445f-bcaa-df4c7d3dfdca/resourceGroups/hub-spoke-demo/providers/Microsoft.RecoveryServices/vaults/vault-m8qbevi0'
```

If the script stops, earlier operations might have completed. Send the error and
preview counts, not authentication headers or access tokens. Rerun the preview
before selecting a next action; do not bypass retention, immutability, locks or
MUA. Modern secure-by-default vaults can retain soft-deleted items/vaults; a
provider retention error is not solved by granting more directory roles.

The script never deletes `hub-spoke-demo`. After successful vault removal,
refresh the exact legacy group and verify it is empty before considering group
deletion separately. No target subscription resources are intentionally selected.

## Verification

PowerShell 7 syntax validation passed. Twenty-six fully mocked offline scenarios
passed: preview with zero writes, confirmation/context/scope guards, read errors,
held ASR/endpoints/MARS, unknown container, external source, empty vault, backup
dependency order, soft-deleted-item rerun, failed backup job, retention rejection,
unverified deletion, and context drift. No Azure calls were made during tests.
Additional ASR cases cover empty-array handling without context initialization,
HTTP 403/404/500 failures, malformed responses, unsafe/repeated pagination,
unexpected fabric IDs and fabric discovery on subsequent pages. Actual Az
module/provider behavior and the vault's contents remain operator checks.

References: [Cloud Shell upload and shell selection](https://learn.microsoft.com/en-us/azure/cloud-shell/use-the-shell-window),
[Recovery Services vault deletion](https://learn.microsoft.com/en-us/azure/backup/backup-azure-delete-vault),
[Current soft-delete behavior](https://learn.microsoft.com/en-us/azure/backup/backup-azure-enhanced-soft-delete-configure-manage),
[Backup job waiting](https://learn.microsoft.com/en-us/powershell/module/az.recoveryservices/wait-azrecoveryservicesbackupjob),
[ASR fabric inventory API](https://learn.microsoft.com/en-us/rest/api/site-recovery/replication-fabrics/list?view=rest-site-recovery-2025-02-01).
