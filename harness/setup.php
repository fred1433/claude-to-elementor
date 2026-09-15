<?php
/**
 * Drives WordPress from the outside, over HTTP, the way a deploy script would.
 *
 *   ?step=activate   turn Elementor on, one request, so that the next request
 *                    boots with Elementor fully loaded at plugins_loaded
 *   ?step=import     1. media    the page's images become real attachments
 *                    2. kit      the design system is written to the active kit
 *                    3. import   the template goes in through Elementor's OWN
 *                                importer, the code path behind Templates >
 *                                Import. An invalid template fails right here.
 *                    4. publish  the imported template becomes the front page
 *
 * No step reformats or "fixes" the template. What renders is what the converter
 * produced.
 */

if ( ! defined( 'ABSPATH' ) ) { require_once '/wordpress/wp-load.php'; }
header( 'Content-Type: application/json' );

$BASE = __DIR__;
$log  = [];
$fail = function ( $msg ) { http_response_code( 500 ); echo json_encode( [ 'ok' => false, 'error' => $msg ] ); exit; };
$step = $_GET['step'] ?? 'import';

/* ------------------------------------------------------------- activate */
if ( $step === 'activate' ) {
	require_once ABSPATH . 'wp-admin/includes/plugin.php';
	$plugin = 'elementor/elementor.php';
	if ( ! file_exists( WP_PLUGIN_DIR . '/' . $plugin ) ) { $fail( 'Elementor is not mounted at ' . WP_PLUGIN_DIR . '/elementor' ); }
	if ( ! is_plugin_active( $plugin ) ) {
		$err = activate_plugin( $plugin );
		if ( is_wp_error( $err ) ) { $fail( 'activation failed: ' . $err->get_error_message() ); }
	}
	/**
	 * A fresh Elementor hijacks the next admin request into its onboarding
	 * wizard, which is where an automated editor session lands instead of the
	 * editor. Marking onboarding as done is what a person clicking Skip does.
	 */
	update_option( 'elementor_onboarded', true );
	delete_transient( 'elementor_activation_redirect' );
	$v = get_file_data( WP_PLUGIN_DIR . '/' . $plugin, [ 'Version' => 'Version' ] );
	echo json_encode( [ 'ok' => true, 'step' => 'activate', 'elementor' => $v['Version'], 'active' => get_option( 'active_plugins' ) ] );
	exit;
}

/* ---------------------------------------------------------------- login */
if ( $step === 'login' ) {
	$admins = get_users( [ 'role' => 'administrator', 'number' => 1, 'orderby' => 'ID' ] );
	if ( empty( $admins ) ) { $fail( 'no administrator account' ); }
	wp_set_current_user( $admins[0]->ID );
	wp_set_auth_cookie( $admins[0]->ID, true );
	echo json_encode( [ 'ok' => true, 'step' => 'login', 'user' => $admins[0]->user_login ] );
	exit;
}

if ( ! did_action( 'elementor/loaded' ) ) { $fail( 'Elementor is not loaded' ); }

/**
 * Change one global colour in the kit and let it propagate.
 *
 * This is the check that tells a client what "global styles" actually buys
 * them. If the page were carrying its own colours, this would change nothing
 * and the harness would say so.
 */
if ( $step === 'recolor' ) {
	$to = isset( $_GET['color'] ) ? sanitize_text_field( wp_unslash( $_GET['color'] ) ) : '';
	if ( ! preg_match( '/^#[0-9A-Fa-f]{6}$/', $to ) ) { $fail( 'recolor needs a #rrggbb colour' ); }
	$kit_id   = \Elementor\Plugin::$instance->kits_manager->get_active_id();
	$settings = get_post_meta( $kit_id, '_elementor_page_settings', true );
	if ( ! is_array( $settings ) ) { $fail( 'the kit has no settings' ); }
	$before = '';
	foreach ( $settings['system_colors'] as $i => $c ) {
		if ( 'accent' === $c['_id'] ) { $before = $c['color']; $settings['system_colors'][ $i ]['color'] = $to; }
	}
	if ( '' === $before ) { $fail( 'no accent colour in the kit' ); }
	$settings['button_background_color'] = $to;
	update_post_meta( $kit_id, '_elementor_page_settings', $settings );
	\Elementor\Plugin::$instance->files_manager->clear_cache();
	\Elementor\Core\Files\CSS\Post::create( $kit_id )->update();
	echo json_encode( [ 'ok' => true, 'step' => 'recolor', 'from' => $before, 'to' => $to ] );
	exit;
}

/**
 * Text edits through Elementor's document save, the call the editor's Update
 * button ends up making. Used only when the editor interface could not be
 * driven; the report says which path was taken for every edit.
 */
if ( $step === 'edit-text' ) {
	$page = get_page_by_path( 'home' );
	if ( ! $page ) { $fail( 'no page to edit' ); }
	$admins = get_users( [ 'role' => 'administrator', 'number' => 1, 'orderby' => 'ID' ] );
	wp_set_current_user( $admins[0]->ID );
	$edits = json_decode( (string) file_get_contents( 'php://input' ), true );
	if ( ! is_array( $edits ) || ! count( $edits ) ) { $fail( 'edit-text needs a JSON body of {currentTitle: newTitle}' ); }
	$data = json_decode( (string) get_post_meta( $page->ID, '_elementor_data', true ), true );
	$done = [];
	/**
	 * Addressed by the text being replaced, not by an id: Elementor regenerates
	 * element ids when it imports a template, so ids from the source JSON do not
	 * exist on the imported page.
	 */
	$walk = function ( &$n ) use ( &$walk, $edits, &$done ) {
		if ( ! is_array( $n ) ) { return; }
		if ( isset( $n['settings']['title'] ) && isset( $edits[ $n['settings']['title'] ] ) ) {
			$done[] = $n['settings']['title'];
			$n['settings']['title'] = $edits[ $n['settings']['title'] ];
		}
		foreach ( $n as $k => &$v ) { if ( is_array( $v ) ) { $walk( $v ); } }
	};
	$walk( $data );
	if ( ! count( $done ) ) { $fail( 'none of those headings are on the page' ); }
	\Elementor\Plugin::$instance->documents->get( $page->ID )->save( [ 'elements' => $data ] );
	\Elementor\Plugin::$instance->files_manager->clear_cache();
	echo json_encode( [ 'ok' => true, 'step' => 'edit-text', 'edited' => $done ] );
	exit;
}

/**
 * Swap a photo for another one already in the media library, through the same
 * document save the editor uses. Reported as an API edit, never as an editor
 * one: see the interventions log in the report.
 */
if ( $step === 'swap-image' ) {
	$page = get_page_by_path( 'home' );
	if ( ! $page ) { $fail( 'no page to edit' ); }
	$doc = \Elementor\Plugin::$instance->documents->get( $page->ID );
	$data = json_decode( (string) get_post_meta( $page->ID, '_elementor_data', true ), true );
	$library = get_posts( [ 'post_type' => 'attachment', 'numberposts' => 20, 'orderby' => 'ID' ] );
	if ( count( $library ) < 2 ) { $fail( 'need at least two images in the library' ); }
	$swapped = null;
	$walk = function ( &$n ) use ( &$walk, $library, &$swapped ) {
		if ( ! is_array( $n ) ) { return; }
		if ( ! $swapped && isset( $n['widgetType'] ) && 'image' === $n['widgetType'] && ! empty( $n['settings']['image']['id'] ) ) {
			foreach ( $library as $att ) {
				if ( (int) $att->ID !== (int) $n['settings']['image']['id'] ) {
					$n['settings']['image'] = [ 'id' => $att->ID, 'url' => wp_get_attachment_url( $att->ID ) ];
					$swapped = wp_get_attachment_url( $att->ID );
					break;
				}
			}
		}
		foreach ( $n as $k => &$v ) { if ( is_array( $v ) ) { $walk( $v ); } }
	};
	$walk( $data );
	if ( ! $swapped ) { $fail( 'found no image widget to swap' ); }
	$admins = get_users( [ 'role' => 'administrator', 'number' => 1, 'orderby' => 'ID' ] );
	wp_set_current_user( $admins[0]->ID );
	$doc->save( [ 'elements' => $data ] );
	\Elementor\Plugin::$instance->files_manager->clear_cache();
	echo json_encode( [ 'ok' => true, 'step' => 'swap-image', 'now' => basename( (string) parse_url( $swapped, PHP_URL_PATH ) ) ] );
	exit;
}

require_once ABSPATH . 'wp-admin/includes/image.php';
require_once ABSPATH . 'wp-admin/includes/file.php';
require_once ABSPATH . 'wp-admin/includes/media.php';

/**
 * Elementor's importer refuses to run without the capability a human would have.
 * We act as the site administrator, which is exactly what Templates > Import
 * does behind the button. No capability check is bypassed, none is weakened.
 */
$admins = get_users( [ 'role' => 'administrator', 'number' => 1, 'orderby' => 'ID' ] );
if ( empty( $admins ) ) { $fail( 'no administrator account on this site' ); }
wp_set_current_user( $admins[0]->ID );
if ( ! current_user_can( 'edit_posts' ) ) { $fail( 'the administrator cannot edit posts' ); }
$log[] = 'acting as ' . $admins[0]->user_login . ' (administrator)';

/* ---------------------------------------------------------------- 1. media */
$updir = wp_upload_dir();
$map   = [];
foreach ( glob( $BASE . '/assets/*' ) as $file ) {
	$name = basename( $file );
	$dest = trailingslashit( $updir['path'] ) . $name;
	if ( ! file_exists( $dest ) ) { copy( $file, $dest ); }
	$type = wp_check_filetype( $name, null );
	$id   = wp_insert_attachment( [
		'post_mime_type' => $type['type'],
		'post_title'     => pathinfo( $name, PATHINFO_FILENAME ),
		'post_status'    => 'inherit',
	], $dest );
	if ( is_wp_error( $id ) ) { $fail( 'attachment failed for ' . $name ); }
	wp_update_attachment_metadata( $id, wp_generate_attachment_metadata( $id, $dest ) );
	$url = trailingslashit( $updir['url'] ) . $name;
	/**
	 * Elementor's template importer looks up already-imported media by
	 * sha1(url) in _elementor_source_image_hash. Writing that meta ourselves is
	 * what stops the import from downloading a second copy of every photo.
	 */
	update_post_meta( $id, '_elementor_source_image_hash', sha1( $url ) );
	$map[ $name ] = [ 'id' => $id, 'url' => $url ];
}
$log[] = 'media: ' . count( $map ) . ' attachments';

/**
 * Point every media reference at the local library. The shipped template.json
 * carries the client's own production URLs; this run is offline, so we resolve
 * them by file name against what we just imported. Applied before AND after the
 * Elementor import, so the render never depends on an outbound request.
 */
$rewrites = 0;
$rewrite  = function ( &$node ) use ( &$rewrite, $map, &$rewrites ) {
	if ( ! is_array( $node ) ) { return; }
	if ( isset( $node['url'] ) && is_string( $node['url'] ) && array_key_exists( 'id', $node ) ) {
		$name = basename( (string) parse_url( $node['url'], PHP_URL_PATH ) );
		if ( $name !== '' && isset( $map[ $name ] ) ) {
			$node['url'] = $map[ $name ]['url'];
			$node['id']  = $map[ $name ]['id'];
			$rewrites++;
		}
	}
	foreach ( $node as $k => &$v ) { if ( is_array( $v ) ) { $rewrite( $v ); } }
};

/* ------------------------------------------------------------------ 2. kit */
$kit_json = json_decode( (string) file_get_contents( $BASE . '/kit.json' ), true );
if ( ! is_array( $kit_json ) ) { $fail( 'kit.json is not valid JSON' ); }
$kit_id = \Elementor\Plugin::$instance->kits_manager->get_active_id();
if ( ! $kit_id ) { $fail( 'no active Elementor kit' ); }
$current = get_post_meta( $kit_id, '_elementor_page_settings', true );
if ( ! is_array( $current ) ) { $current = []; }
update_post_meta( $kit_id, '_elementor_page_settings', array_merge( $current, $kit_json ) );
$log[] = 'kit: ' . count( $kit_json ) . ' settings on kit #' . $kit_id;

/* --------------------------------------------------------------- 3. import */
$tpl = json_decode( (string) file_get_contents( $BASE . '/template.json' ), true );
if ( ! is_array( $tpl ) ) { $fail( 'template.json is not valid JSON' ); }
$rewrite( $tpl );
$staged = trailingslashit( $updir['basedir'] ) . 'template.staged.json';
file_put_contents( $staged, wp_json_encode( $tpl ) );
$log[] = 'media rewrites (pre-import): ' . $rewrites;

$source = \Elementor\Plugin::$instance->templates_manager->get_source( 'local' );
if ( ! $source ) { $fail( 'no local template source' ); }
$imported = $source->import_template( 'converted-page.json', $staged );
if ( is_wp_error( $imported ) ) { $fail( 'Elementor refused the template: ' . $imported->get_error_message() ); }
if ( empty( $imported[0]['template_id'] ) ) { $fail( 'import returned no template id' ); }
$tpl_id = (int) $imported[0]['template_id'];
$log[]  = 'imported through Elementor Source_Local::import_template as library template #' . $tpl_id;

/* -------------------------------------------------------------- 4. publish */
$content = json_decode( (string) get_post_meta( $tpl_id, '_elementor_data', true ), true );
if ( ! is_array( $content ) || ! count( $content ) ) { $fail( 'imported template has no content' ); }
$rewrites = 0;
$rewrite( $content );
$log[] = 'media rewrites (post-import): ' . $rewrites;

/**
 * The page is created through Elementor's own document manager, not through
 * wp_insert_post. That is what writes _elementor_edit_mode = builder; without
 * it WordPress renders Elementor's plain-text fallback and the page comes out
 * unstyled, which is exactly the kind of silent half-success this harness
 * exists to catch.
 */
$doc = \Elementor\Plugin::$instance->documents->create( 'wp-page', [
	'post_title'  => 'Home',
	'post_name'   => 'home',
	'post_type'   => 'page',
	'post_status' => 'publish',
] );
if ( is_wp_error( $doc ) ) { $fail( 'could not create the document: ' . $doc->get_error_message() ); }
$page_id = $doc->get_main_id();
if ( ! $doc->save( [
	'elements' => $content,
	'settings' => [ 'template' => 'elementor_canvas', 'hide_title' => 'yes' ],
] ) ) { $fail( 'Elementor refused to save the document' ); }
if ( ! $doc->is_built_with_elementor() ) { $fail( 'the page is not flagged as built with Elementor' ); }

update_option( 'show_on_front', 'page' );
update_option( 'page_on_front', $page_id );
\Elementor\Plugin::$instance->files_manager->clear_cache();
\Elementor\Core\Files\CSS\Post::create( $kit_id )->update();
\Elementor\Core\Files\CSS\Post::create( $page_id )->update();

$sections = array_map( fn( $c ) => $c['settings']['_element_id'] ?? '?', $content );
$log[]    = 'published page #' . $page_id . ' on elementor_canvas with ' . count( $content ) . ' top-level sections';

echo json_encode( [ 'ok' => true, 'step' => 'import', 'page_id' => $page_id, 'template_id' => $tpl_id, 'sections' => $sections, 'log' => $log ], JSON_PRETTY_PRINT );
