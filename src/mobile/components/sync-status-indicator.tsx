import { SyncStatusIndicatorView } from "@/components/sync-status-indicator";
import ConfirmDeleteDialog from "@/mobile/components/common/confirm-delete-dialog";
import { useTranslation } from "@/mobile/i18n";
import { isIOS } from "@/utils/platform";

export default function SyncStatusIndicator() {
  const { t } = useTranslation();
  return <SyncStatusIndicatorView t={t} mobile={isIOS()} ConfirmDialog={ConfirmDeleteDialog} />;
}
