//! Explicit iOS startup state machine. The transition table is documented in
//! `docs/state-machines/startup.md` and pinned by the tests below.

use serde::Serialize;
use std::sync::Mutex;

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(tag = "state", rename_all = "snake_case")]
pub enum StartupState {
    Starting,
    Ready,
    Failed { message: String, retryable: bool },
    Retrying { message: String },
}

#[derive(Clone, Debug, PartialEq)]
pub enum StartupEvent {
    Succeeded,
    Failed { message: String, retryable: bool },
    RetryRequested,
}

impl StartupState {
    /// The failure reported while startup is not complete. `Retrying` keeps
    /// the message of the failure being retried.
    pub fn failure(&self) -> Option<&str> {
        match self {
            Self::Failed { message, .. } | Self::Retrying { message } => Some(message),
            Self::Starting | Self::Ready => None,
        }
    }
}

/// Returns the next state, or `None` when the event is not legal in `state`.
pub fn transition(state: &StartupState, event: StartupEvent) -> Option<StartupState> {
    use StartupState::{Failed, Ready, Retrying, Starting};
    match (state, event) {
        (Starting | Retrying { .. }, StartupEvent::Succeeded) => Some(Ready),
        (Starting | Retrying { .. }, StartupEvent::Failed { message, retryable }) => {
            Some(Failed { message, retryable })
        }
        (
            Failed {
                message,
                retryable: true,
            },
            StartupEvent::RetryRequested,
        ) => Some(Retrying {
            message: message.clone(),
        }),
        _ => None,
    }
}

/// Applies `event` to the shared state. Returns `false` and leaves the state
/// unchanged when the transition is not legal.
pub fn dispatch(state: &Mutex<StartupState>, event: StartupEvent) -> bool {
    let mut state = state
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    match transition(&state, event) {
        Some(next) => {
            *state = next;
            true
        }
        None => false,
    }
}

#[cfg(test)]
mod tests {
    use super::{dispatch, transition, StartupEvent, StartupState};
    use std::sync::Mutex;

    fn failed(message: &str, retryable: bool) -> StartupState {
        StartupState::Failed {
            message: message.to_string(),
            retryable,
        }
    }

    fn retrying(message: &str) -> StartupState {
        StartupState::Retrying {
            message: message.to_string(),
        }
    }

    fn failure(message: &str, retryable: bool) -> StartupEvent {
        StartupEvent::Failed {
            message: message.to_string(),
            retryable,
        }
    }

    #[test]
    fn success_while_starting_or_retrying_is_ready() {
        for state in [StartupState::Starting, retrying("key unavailable")] {
            assert_eq!(
                transition(&state, StartupEvent::Succeeded),
                Some(StartupState::Ready)
            );
        }
    }

    #[test]
    fn failure_while_starting_or_retrying_keeps_its_message_and_retryable_flag() {
        for state in [StartupState::Starting, retrying("key unavailable")] {
            assert_eq!(
                transition(&state, failure("key still unavailable", true)),
                Some(failed("key still unavailable", true))
            );
            assert_eq!(
                transition(&state, failure("database is newer than the app", false)),
                Some(failed("database is newer than the app", false))
            );
        }
    }

    #[test]
    fn retry_of_a_retryable_failure_keeps_the_message() {
        assert_eq!(
            transition(
                &failed("key unavailable", true),
                StartupEvent::RetryRequested
            ),
            Some(retrying("key unavailable"))
        );
    }

    #[test]
    fn retry_is_refused_for_terminal_failure_running_retry_ready_and_starting() {
        for state in [
            failed("database is newer than the app", false),
            retrying("key unavailable"),
            StartupState::Ready,
            StartupState::Starting,
        ] {
            assert_eq!(transition(&state, StartupEvent::RetryRequested), None);
        }
    }

    #[test]
    fn results_are_ignored_once_startup_is_ready_or_failed() {
        for state in [
            StartupState::Ready,
            failed("key unavailable", true),
            failed("database is newer than the app", false),
        ] {
            assert_eq!(transition(&state, StartupEvent::Succeeded), None);
            assert_eq!(transition(&state, failure("late", true)), None);
        }
    }

    #[test]
    fn failure_message_is_reported_while_failed_and_while_retrying() {
        assert_eq!(StartupState::Starting.failure(), None);
        assert_eq!(StartupState::Ready.failure(), None);
        assert_eq!(
            failed("key unavailable", true).failure(),
            Some("key unavailable")
        );
        assert_eq!(
            retrying("key unavailable").failure(),
            Some("key unavailable")
        );
    }

    #[test]
    fn status_serialises_as_state_with_optional_message_and_retryable() {
        let json = |state: &StartupState| serde_json::to_value(state).unwrap();
        assert_eq!(
            json(&StartupState::Starting),
            serde_json::json!({ "state": "starting" })
        );
        assert_eq!(
            json(&StartupState::Ready),
            serde_json::json!({ "state": "ready" })
        );
        assert_eq!(
            json(&failed("key unavailable", true)),
            serde_json::json!({ "state": "failed", "message": "key unavailable", "retryable": true })
        );
        assert_eq!(
            json(&retrying("key unavailable")),
            serde_json::json!({ "state": "retrying", "message": "key unavailable" })
        );
    }

    #[test]
    fn dispatch_applies_legal_events_and_refuses_the_rest_without_changing_state() {
        let state = Mutex::new(StartupState::Starting);
        assert!(dispatch(&state, failure("key unavailable", true)));
        assert!(dispatch(&state, StartupEvent::RetryRequested));
        // A second retry while one is running is refused, as `ios_retry_startup` does today.
        assert!(!dispatch(&state, StartupEvent::RetryRequested));
        assert_eq!(*state.lock().unwrap(), retrying("key unavailable"));
        assert!(dispatch(
            &state,
            failure("database is newer than the app", false)
        ));
        assert!(!dispatch(&state, StartupEvent::RetryRequested));
        assert!(!dispatch(&state, StartupEvent::Succeeded));
        assert_eq!(
            *state.lock().unwrap(),
            failed("database is newer than the app", false)
        );
    }
}
