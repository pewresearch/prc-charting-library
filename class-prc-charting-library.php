<?php
/**
 *
 * @package           PRC_Charting_Library
 * @author            Ben Wormald
 * @copyright         2023 Pew Research Center
 * @license           GPL-2.0-or-later
 *
 * @wordpress-plugin
 * Plugin Name:       PRC Charting Library
 * Plugin URI:        https://github.com/pewresearch/pewresearch-org
 * Description:       Pew Research Center's propietary charting library framework for use in PRC Platform.
 * Version:           3.12.0
 * Requires at least: 6.2
 * Requires PHP:      8.0
 * Requires Plugins:  prc-scripts
 * Author:            Ben Wormald
 * Author URI:        https://pewresearch.org
 * Text Domain:       prc-charting-library
 * License:           GPL v2 or later
 * License URI:       http://www.gnu.org/licenses/gpl-2.0.txt
 */

class PRC_Charting_Library {
	public function __construct( $init = false ) {
		if ( true === $init ) {
			add_action( 'wp_enqueue_scripts', array( $this, 'init_charting_library_script' ), 0 );
			add_action( 'admin_enqueue_scripts', array( $this, 'init_charting_library_script' ), 0 );
			add_action( 'init', array( $this, 'init_charting_library_script_module' ) );
		}
	}

	/**
	 * Register the editor / classic-script bundle.
	 *
	 * Used by the block editor and any frontend consumer still on the classic
	 * script-handle path (notably the `prc-custom-charts` fallback). The
	 * Preact Script Module registered by init_charting_library_script_module()
	 * is the preferred frontend path going forward.
	 *
	 * Fires early on wp_enqueue_scripts and admin_enqueue_scripts.
	 *
	 * @return void
	 */
	public function init_charting_library_script() {
		$asset_file = include plugin_dir_path( __FILE__ ) . 'build/editor.asset.php';
		$script_src = plugin_dir_url( __FILE__ ) . 'build/editor.js';
		$build_url  = plugin_dir_url( __FILE__ ) . 'build/';

		$script = wp_register_script(
			'prc-charting-library',
			$script_src,
			$asset_file['dependencies'],
			$asset_file['version'],
			true
		);

		// Localize script to pass build URL for webpack chunk loading.
		// WordPress VIP serves main bundles from _static, but chunks remain in plugin directory.
		wp_localize_script(
			'prc-charting-library',
			'prcChartingLibraryConfig',
			array(
				'buildUrl' => $build_url,
			)
		);

		if ( ! $script ) {
			return new WP_Error( 'prc-charting-library', __( 'Error registering script.' ) );
		}
	}

	/**
	 * Register the Preact frontend Script Module.
	 *
	 * Registered as `@prc/charting-library` so consuming plugins can declare a
	 * static `import { ... } from '@prc/charting-library'` in their view
	 * scripts (Script Module dep ordering then guarantees this module
	 * evaluates first).
	 *
	 * `@wordpress/interactivity` is declared as an explicit module dep so the
	 * interactivity runtime is ready when the chart bundle imports `store()`
	 * (PRC-17 slice 3). The bundle does not import it today; declaring it now
	 * means slice 3 lands without re-registering.
	 *
	 * @return void
	 */
	public function init_charting_library_script_module() {
		$asset_path = plugin_dir_path( __FILE__ ) . 'build/view.asset.php';
		if ( ! file_exists( $asset_path ) ) {
			return;
		}

		$asset_file = include $asset_path;
		$script_src = plugin_dir_url( __FILE__ ) . 'build/view.js';

		// Vendor handles (d3, DOMPurify, emotion-styled) are externalized only
		// for the editor classic-script bundle. The Preact view module bundles
		// those libraries so it can run on preact/compat without window globals.
		$dependencies = array_values(
			array_unique(
				array_merge(
					(array) ( $asset_file['dependencies'] ?? array() ),
					array(
						'@wordpress/interactivity',
					)
				)
			)
		);

		wp_register_script_module(
			'@prc/charting-library',
			$script_src,
			$dependencies,
			$asset_file['version'] ?? false
		);
	}
}

$prc_charting_library = new PRC_Charting_Library( true );
