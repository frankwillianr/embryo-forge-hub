import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { supabase } from '@/integrations/supabase/client';

interface UsePushNotificationsProps {
  cidadeId: string | null;
  userId?: string | null;
  cidadeSlug?: string | null;
  pagina?: string;
}

export function usePushNotifications({
  cidadeId,
  userId = null,
  cidadeSlug = null,
  pagina = "cidade",
}: UsePushNotificationsProps) {
  const [token, setToken] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied' | 'prompt'>('prompt');
  const [lastError, setLastError] = useState<string | null>(null);

  const logPushDebug = async (
    evento: string,
    details?: Record<string, unknown> | null,
    tokenValue?: string | null,
    permissionValue?: 'granted' | 'denied' | 'prompt' | null,
    errorValue?: string | null
  ) => {
    try {
      const tokenSource = tokenValue ?? token;
      const permissionSource = permissionValue ?? permissionStatus;
      const errorSource = errorValue ?? lastError;

      const payload = {
        user_id: userId || null,
        cidade_id: cidadeId || null,
        cidade_slug: cidadeSlug || null,
        pagina,
        evento,
        push_permission_status: permissionSource ?? null,
        push_token_presente: !!tokenSource,
        push_token_prefix: tokenSource ? tokenSource.slice(0, 24) : null,
        push_error: errorSource || null,
        app_platform: Capacitor.getPlatform(),
        detalhes: details ?? null,
      };

      await supabase.from("usuario_log_login" as any).insert(payload as any);
      console.debug("[PushDebug] evento registrado", evento, payload);
    } catch (error) {
      console.warn("[PushDebug] falha ao gravar log", evento, error);
    }
  };

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      console.log('Push notifications so funcionam em apps nativos');
      void logPushDebug("push_not_native_platform", {
        isNativePlatform: false,
        platform: Capacitor.getPlatform(),
      });
      return;
    }

    const initPushNotifications = async () => {
      try {
        void logPushDebug("push_init_start", {
          platform: Capacitor.getPlatform(),
          hasCidadeId: !!cidadeId,
          hasUserId: !!userId,
          cidadeId,
          userId,
          cidadeSlug,
          pagina,
        });

        // Verifica permissao atual
        const permStatus = await PushNotifications.checkPermissions();
        void logPushDebug("push_check_permissions", {
          checkPermissionsReceive: permStatus.receive,
        }, token, permStatus.receive as 'granted' | 'denied' | 'prompt');

        if (permStatus.receive === 'prompt') {
          // Solicita permissao
          const requestResult = await PushNotifications.requestPermissions();
          setPermissionStatus(requestResult.receive as 'granted' | 'denied' | 'prompt');
          void logPushDebug("push_request_permissions", {
            requestPermissionsReceive: requestResult.receive,
          }, token, requestResult.receive as 'granted' | 'denied' | 'prompt');

          if (requestResult.receive !== 'granted') {
            console.log('Permissao de notificacao negada');
            void logPushDebug("push_permission_not_granted", {
              permissionAfterRequest: requestResult.receive,
            }, token, requestResult.receive as 'granted' | 'denied' | 'prompt');
            return;
          }
        } else if (permStatus.receive === 'denied') {
          setPermissionStatus('denied');
          console.log('Permissao de notificacao negada anteriormente');
          void logPushDebug("push_permission_previously_denied", {
            permissionStatus: permStatus.receive,
          }, token, 'denied');
          return;
        } else {
          setPermissionStatus('granted');
          void logPushDebug("push_permission_already_granted", {
            permissionStatus: permStatus.receive,
          }, token, 'granted');
        }

        if (Capacitor.getPlatform() === 'android') {
          try {
            await PushNotifications.createChannel({
              id: 'default',
              name: 'Notificacoes',
              description: 'Canal padrao de notificacoes',
              importance: 5,
              visibility: 1,
              vibration: true,
              lights: true,
            });
            void logPushDebug("push_create_channel_ok", {
              channelId: "default",
            }, token, "granted");
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            setLastError(message);
            void logPushDebug("push_create_channel_error", {
              channelId: "default",
              error: message,
            }, token, "granted", message);
          }
        }

        // Listener para receber o token
        const registrationListener = await PushNotifications.addListener('registration', async (tokenData) => {
          console.log('Token de push recebido:', tokenData.value);
          setToken(tokenData.value);
          setLastError(null);
          void logPushDebug("push_registration_token_received", {
            tokenLength: tokenData.value?.length ?? 0,
            tokenSuffix: tokenData.value ? tokenData.value.slice(-12) : null,
          }, tokenData.value, "granted", null);

          // Salva o token no Supabase se tiver cidade
          if (cidadeId && tokenData.value) {
            await saveTokenToSupabase(cidadeId, tokenData.value, userId);
          } else {
            void logPushDebug("push_registration_skipped_save", {
              reason: "missing_cidade_or_token",
              hasCidadeId: !!cidadeId,
              hasToken: !!tokenData.value,
            }, tokenData.value, "granted");
          }
        });

        // Listener para erros de registro
        const registrationErrorListener = await PushNotifications.addListener('registrationError', (error) => {
          console.error('Erro ao registrar push:', error);
          const errorMessage = error?.error || error?.message || JSON.stringify(error);
          setLastError(errorMessage);
          void logPushDebug("push_registration_error", {
            rawError: error,
          }, token, permissionStatus, errorMessage);
        });

        // Listener para notificacoes recebidas (app em primeiro plano)
        const receivedListener = await PushNotifications.addListener('pushNotificationReceived', (notification) => {
          console.log('Notificacao recebida:', notification);
        });

        // Listener para quando usuario toca na notificacao
        const actionListener = await PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
          console.log('Acao na notificacao:', notification);
        });

        // Registra para push notifications (depois dos listeners)
        void logPushDebug("push_register_called", {
          hasCidadeId: !!cidadeId,
          hasUserId: !!userId,
        }, token, "granted");
        await PushNotifications.register();
        void logPushDebug("push_register_completed", null, token, "granted");

        return () => {
          registrationListener.remove();
          registrationErrorListener.remove();
          receivedListener.remove();
          actionListener.remove();
          void logPushDebug("push_listeners_removed", null);
        };
      } catch (error) {
        console.error('Erro ao inicializar push notifications:', error);
        const message = error instanceof Error ? error.message : String(error);
        setLastError(message);
        void logPushDebug("push_init_exception", {
          error: message,
        }, token, permissionStatus, message);
        return undefined;
      }
    };

    let cleanupPromise: Promise<(() => void) | undefined> | null = initPushNotifications();

    return () => {
      if (cleanupPromise) {
        cleanupPromise.then((cleanup) => cleanup?.());
      }
      cleanupPromise = null;
    };
  }, [cidadeId, userId]);

  // Salva/atualiza token
  const saveTokenToSupabase = async (cidadeIdValue: string, deviceToken: string, currentUserId?: string | null) => {
    const platform = Capacitor.getPlatform(); // 'ios' | 'android' | 'web'

    try {
      void logPushDebug("push_upsert_attempt", {
        cidadeIdValue,
        platform,
        hasUserId: !!currentUserId,
        userId: currentUserId || null,
        tokenLength: deviceToken?.length ?? 0,
      }, deviceToken);

      const { data, error } = await supabase.rpc(
        "upsert_cidade_push_token" as any,
        {
          p_cidade_id: cidadeIdValue,
          p_device_token: deviceToken,
          p_platform: platform,
          p_user_id: currentUserId || null,
          p_device_id: null,
        } as any
      );

      if (error) {
        console.error('Erro ao salvar token:', error);
        const errorMessage = [
          error.message,
          error.details,
          error.hint,
          error.code,
        ].filter(Boolean).join(" | ");
        setLastError(errorMessage || "erro_ao_salvar_token");
        void logPushDebug("push_upsert_error", {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        }, deviceToken, permissionStatus, errorMessage);
      } else {
        console.log('Token salvo com sucesso para cidade:', cidadeIdValue);
        setLastError(null);
        const persisted = Array.isArray(data) ? data[0] : data;
        void logPushDebug("push_upsert_success", {
          cidadeIdValue,
          hasUserId: !!currentUserId,
          userId: currentUserId || null,
          platform,
          persistedUserId: persisted?.user_id ?? null,
          persistedUpdatedAt: persisted?.updated_at ?? null,
          usedRpc: true,
        }, deviceToken, permissionStatus, null);
      }
    } catch (error) {
      console.error('Erro ao salvar token no Supabase:', error);
      const message = error instanceof Error ? error.message : String(error);
      setLastError(message);
      void logPushDebug("push_upsert_exception", {
        error: message,
        cidadeIdValue,
        hasUserId: !!currentUserId,
      }, deviceToken, permissionStatus, message);
    }
  };

  const updateCidade = async (newCidadeId: string) => {
    if (token && newCidadeId) {
      await saveTokenToSupabase(newCidadeId, token, userId);
    }
  };

  // Backfill automatico: quando usuario loga (ou app reabre com sessao),
  // vincula o token ja existente ao user_id sem depender de novo registro.
  useEffect(() => {
    if (!cidadeId || !token || !userId) return;
    void logPushDebug("push_backfill_start", {
      cidadeId,
      userId,
    }, token);
    void saveTokenToSupabase(cidadeId, token, userId);
  }, [cidadeId, token, userId]);

  return {
    token,
    permissionStatus,
    lastError,
    updateCidade,
  };
}
