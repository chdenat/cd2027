<?php
/**
 * Plugin Name: CD2027 GitHub publishing webhook
 * Description: Queues public WordPress content changes for the Eleventy build workflow.
 */

defined('ABSPATH') || exit;

const CD2027_ELEVENTY_OUTBOX_OPTION = 'cd2027_eleventy_webhook_outbox';
const CD2027_ELEVENTY_SEND_HOOK = 'cd2027_send_eleventy_webhook';
const CD2027_GITHUB_DISPATCH_EVENT_TYPE = 'cd2027_deploy';

add_action('wp_after_insert_post', 'cd2027_queue_eleventy_post_change', 20, 4);
add_action('woocommerce_new_product', 'cd2027_queue_eleventy_product_change', 100, 1);
add_action('woocommerce_update_product', 'cd2027_queue_eleventy_product_change', 100, 1);
add_action('created_term', 'cd2027_queue_eleventy_term_change', 10, 3);
add_action('edited_term', 'cd2027_queue_eleventy_term_change', 10, 3);
add_action('delete_term', 'cd2027_queue_eleventy_term_deletion', 10, 5);
add_action('added_post_meta', 'cd2027_queue_eleventy_post_meta_change', 10, 4);
add_action('updated_post_meta', 'cd2027_queue_eleventy_post_meta_change', 10, 4);
add_action('deleted_post_meta', 'cd2027_queue_eleventy_post_meta_change', 10, 4);
add_action('set_object_terms', 'cd2027_queue_eleventy_taxonomy_relation_change', 10, 6);
add_action('added_term_meta', 'cd2027_queue_eleventy_term_meta_change', 10, 4);
add_action('updated_term_meta', 'cd2027_queue_eleventy_term_meta_change', 10, 4);
add_action('deleted_term_meta', 'cd2027_queue_eleventy_term_meta_change', 10, 4);
add_action('add_attachment', 'cd2027_queue_eleventy_media_change', 10, 1);
add_action('attachment_updated', 'cd2027_queue_eleventy_media_change', 10, 1);
add_action('delete_attachment', 'cd2027_queue_eleventy_media_deletion', 10, 1);
add_action('wp_update_nav_menu', 'cd2027_queue_eleventy_menu_change', 10, 1);
add_action(CD2027_ELEVENTY_SEND_HOOK, 'cd2027_send_eleventy_webhook');
add_action('init', 'cd2027_resume_eleventy_webhook_outbox');

function cd2027_queue_eleventy_post_change($post_id, $post, $update, $post_before) {
    if (!$post instanceof WP_Post || wp_is_post_revision($post_id) || wp_is_post_autosave($post_id)) {
        return;
    }

    $post_type = get_post_type_object($post->post_type);
    $is_navigation = $post->post_type === 'wp_navigation';
    if (!$post_type || (!$post_type->public && !$is_navigation)) {
        return;
    }

    $previously_public = $post_before instanceof WP_Post && $post_before->post_status === 'publish';
    if ($post->post_status !== 'publish' && !$previously_public) {
        return;
    }

    $changed = array();
    if (!$post_before instanceof WP_Post) {
        $changed = array('created');
    } else {
        foreach (array(
            'post_title' => 'title',
            'post_content' => 'content',
            'post_excerpt' => 'excerpt',
            'post_status' => 'status',
            'post_name' => 'slug',
            'post_parent' => 'parent',
            'menu_order' => 'order',
        ) as $property => $field) {
            if ($post_before->$property !== $post->$property) {
                $changed[] = $field;
            }
        }
    }

    if ($changed) {
        cd2027_queue_eleventy_event($post->post_type, $post_id, $post->post_status, $changed, $post->post_modified_gmt);
    }
}

function cd2027_queue_eleventy_product_change($product_id) {
    $post = get_post($product_id);
    if (!$post instanceof WP_Post || $post->post_status !== 'publish') {
        return;
    }
    cd2027_queue_eleventy_event('product', $product_id, $post->post_status, array('product'), $post->post_modified_gmt);
}

function cd2027_queue_eleventy_post_meta_change($meta_id, $object_id, $meta_key, $meta_value) {
    $post = get_post($object_id);
    if (!$post instanceof WP_Post) {
        return;
    }
    if ($post->post_type === 'attachment' && in_array($meta_key, array('_wp_attachment_metadata', '_wp_attached_file'), true)) {
        cd2027_queue_eleventy_event('media', $object_id, 'publish', array('media_metadata'), $post->post_modified_gmt);
        return;
    }
    if ($post->post_status !== 'publish') return;
    $post_type = get_post_type_object($post->post_type);
    if (!$post_type || (!$post_type->public && $post->post_type !== 'product')) {
        return;
    }
    $ignored_keys = array('_edit_lock', '_edit_last', '_wp_old_date', '_encloseme', '_pingme');
    if (in_array($meta_key, $ignored_keys, true) || strpos($meta_key, '_oembed_') === 0 || strpos($meta_key, '_transient_') === 0) {
        return;
    }
    cd2027_queue_eleventy_event($post->post_type, $object_id, $post->post_status, array('metadata'), $post->post_modified_gmt);
}

function cd2027_queue_eleventy_taxonomy_relation_change($object_id, $terms, $term_taxonomy_ids, $taxonomy, $append, $old_term_taxonomy_ids) {
    $taxonomy_object = get_taxonomy($taxonomy);
    $post = get_post($object_id);
    if (!$taxonomy_object || !$taxonomy_object->public || !$post instanceof WP_Post || $post->post_status !== 'publish') {
        return;
    }
    cd2027_queue_eleventy_event('taxonomy_relation', $object_id, $post->post_status, array('taxonomy_relation', $taxonomy), $post->post_modified_gmt);
}

function cd2027_queue_eleventy_term_meta_change($meta_id, $term_id, $meta_key, $meta_value) {
    $term = get_term($term_id);
    if (is_wp_error($term) || !$term) {
        return;
    }
    $taxonomy_object = get_taxonomy($term->taxonomy);
    if ($taxonomy_object && $taxonomy_object->public) {
        cd2027_queue_eleventy_event('term', $term_id, 'publish', array('taxonomy_meta', $term->taxonomy), gmdate('c'));
    }
}

function cd2027_queue_eleventy_term_change($term_id, $term_taxonomy_id, $taxonomy) {
    $taxonomy_object = get_taxonomy($taxonomy);
    if ($taxonomy_object && $taxonomy_object->public) {
        cd2027_queue_eleventy_event('term', $term_id, 'publish', array('taxonomy', $taxonomy), gmdate('c'));
    }
}

function cd2027_queue_eleventy_term_deletion($term_id, $term_taxonomy_id, $taxonomy, $deleted_term, $object_ids) {
    $taxonomy_object = get_taxonomy($taxonomy);
    if ($taxonomy_object && $taxonomy_object->public) {
        cd2027_queue_eleventy_event('term', $term_id, 'trash', array('taxonomy', $taxonomy, 'deleted'), gmdate('c'));
    }
}

function cd2027_queue_eleventy_media_change($attachment_id) {
    $post = get_post($attachment_id);
    if ($post instanceof WP_Post) {
        cd2027_queue_eleventy_event('media', $attachment_id, 'publish', array('media'), $post->post_modified_gmt);
    }
}

function cd2027_queue_eleventy_media_deletion($attachment_id) {
    cd2027_queue_eleventy_event('media', $attachment_id, 'trash', array('media', 'deleted'), gmdate('c'));
}

function cd2027_queue_eleventy_menu_change($menu_id) {
    cd2027_queue_eleventy_event('menu', $menu_id, 'publish', array('menu'), gmdate('c'));
}

function cd2027_queue_eleventy_event($record_type, $record_id, $status, $changed_fields, $modified_gmt) {
    $event = array(
        'event_id' => wp_generate_uuid4(),
        'record_type' => sanitize_key($record_type),
        'record_id' => (int) $record_id,
        'status' => (string) $status,
        'changed_fields' => array_values(array_unique(array_map('sanitize_key', $changed_fields))),
        'modified_gmt' => gmdate('c', strtotime($modified_gmt . ' UTC') ?: time()),
    );

    $outbox = get_option(CD2027_ELEVENTY_OUTBOX_OPTION, array());
    $outbox[$event['event_id']] = array('event' => $event, 'attempts' => 0, 'queued_at' => time());
    update_option(CD2027_ELEVENTY_OUTBOX_OPTION, $outbox, false);
    cd2027_schedule_eleventy_webhook(5);
}

function cd2027_resume_eleventy_webhook_outbox() {
    if (get_option(CD2027_ELEVENTY_OUTBOX_OPTION, array())) {
        cd2027_schedule_eleventy_webhook(5);
    }
}

function cd2027_schedule_eleventy_webhook($delay) {
    if (!wp_next_scheduled(CD2027_ELEVENTY_SEND_HOOK)) {
        wp_schedule_single_event(time() + (int) $delay, CD2027_ELEVENTY_SEND_HOOK);
    }
}

function cd2027_send_eleventy_webhook() {
    if (!defined('CD2027_GITHUB_DISPATCH_TOKEN') || !defined('CD2027_GITHUB_REPOSITORY')) {
        error_log('CD2027 publish queue is waiting for its GitHub dispatch configuration.');
        return;
    }

    $repository = (string) CD2027_GITHUB_REPOSITORY;
    if (!preg_match('/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/', $repository) || !CD2027_GITHUB_DISPATCH_TOKEN) {
        error_log('CD2027 publish queue has an invalid GitHub dispatch configuration.');
        return;
    }

    $outbox = get_option(CD2027_ELEVENTY_OUTBOX_OPTION, array());
    if (!$outbox) {
        return;
    }

    $event_ids = array_slice(array_keys($outbox), 0, 100);
    $body = wp_json_encode(array(
        'event_type' => CD2027_GITHUB_DISPATCH_EVENT_TYPE,
        'client_payload' => array(
            'batch_id' => $outbox[$event_ids[0]]['event']['event_id'],
            'event_count' => count($event_ids),
        ),
    ));
    if (!is_string($body)) {
        cd2027_retry_eleventy_webhook($event_ids[0]);
        return;
    }

    $response = wp_remote_post('https://api.github.com/repos/' . rawurlencode(strstr($repository, '/', true)) . '/' . rawurlencode(substr(strstr($repository, '/'), 1)) . '/dispatches', array(
        'timeout' => 15,
        'redirection' => 0,
        'blocking' => true,
        'headers' => array(
            'Accept' => 'application/vnd.github+json',
            'Content-Type' => 'application/json',
            'Authorization' => 'Bearer ' . CD2027_GITHUB_DISPATCH_TOKEN,
            'X-GitHub-Api-Version' => '2022-11-28',
        ),
        'body' => $body,
    ));

    if (!is_wp_error($response) && wp_remote_retrieve_response_code($response) === 204) {
        $outbox = get_option(CD2027_ELEVENTY_OUTBOX_OPTION, array());
        foreach ($event_ids as $event_id) {
            unset($outbox[$event_id]);
        }
        update_option(CD2027_ELEVENTY_OUTBOX_OPTION, $outbox, false);
        if ($outbox) {
            cd2027_schedule_eleventy_webhook(1);
        }
        return;
    }

    cd2027_retry_eleventy_webhook($event_ids[0]);
}

function cd2027_retry_eleventy_webhook($event_id) {
    $outbox = get_option(CD2027_ELEVENTY_OUTBOX_OPTION, array());
    if (!isset($outbox[$event_id])) {
        return;
    }
    $outbox[$event_id]['attempts'] = (int) $outbox[$event_id]['attempts'] + 1;
    update_option(CD2027_ELEVENTY_OUTBOX_OPTION, $outbox, false);
    $delay = min(21600, 15 * (2 ** min(10, $outbox[$event_id]['attempts'])));
    cd2027_schedule_eleventy_webhook($delay);
}
