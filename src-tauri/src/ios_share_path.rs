use std::path::{Component, Path};

pub fn is_allowed_share_path(source: &Path, cache: &Path) -> bool {
    let Ok(relative) = source.strip_prefix(cache) else {
        return false;
    };
    let mut components = relative.components();
    matches!(
        (components.next(), components.next(), components.next()),
        (Some(Component::Normal(folder)), Some(Component::Normal(file)), None)
            if uuid::Uuid::parse_str(&folder.to_string_lossy()).is_ok()
                && file == "track3-export-data.json"
    )
}

#[cfg(test)]
mod tests {
    use super::is_allowed_share_path;
    use std::path::Path;

    #[test]
    fn accepts_only_a_named_export_in_a_private_cache_folder() {
        let cache = Path::new("/app/cache");
        assert!(is_allowed_share_path(
            Path::new("/app/cache/550e8400-e29b-41d4-a716-446655440000/track3-export-data.json"),
            cache,
        ));
        assert!(!is_allowed_share_path(
            Path::new("/app/cache/550e8400-e29b-41d4-a716-446655440000/private.json"),
            cache,
        ));
        assert!(!is_allowed_share_path(
            Path::new("/app/cache/not-a-uuid/track3-export-data.json"),
            cache,
        ));
        assert!(!is_allowed_share_path(
            Path::new(
                "/app/elsewhere/550e8400-e29b-41d4-a716-446655440000/track3-export-data.json"
            ),
            cache,
        ));
    }
}
