<?php

/*!
 * Ghostsheet2
 * -----------
 * @class Fetch and cache Google Spreadsheet published data
 * @author mach3<http://github.com/mach3>
 * @url http://github.com/mach3/ghostsheet2
 */

class Ghostsheet {

	const ERROR_INVALID_MODE = "Invalid mode";
	const ERROR_NOT_FOUND = "Not found";

	/**
	 * Options:
	 * - {String} cache_suffix    ... Extension for cache file
	 * - {String} cache_dir       ... Directory to save cache
	 * - {Integer} cache_lifetime ... Lifetime of cache file
	 * - {String} url             ... Google spreadsheet pubhtml URL format
	 * - {Integer} timeout        ... Timeout seconds for CURL
	 */
	private $options = array(
		"cache_suffix" => ".cache",
		"cache_dir" => "./cache",
		"cache_lifetime" => 3600,
		"url" => "https://docs.google.com/spreadsheets/d/%s/pubhtml",
		"timeout" => 30
	);

	/**
	 * Available mode names
	 */
	private $modes = array(
		"load",
		"fetch",
		"cache",
		"update"
	);

	/**
	 * Configure options
	 * 
	 * @param {String|Array} $key|$vars
	 * @param {*} $value
	 */
	public function config(){
		$args = func_get_args();
		switch(count($args)){
			case 2:
				return $this->options[$args[0]] = $args[1];
			case 1:
				if(gettype($args[0]) === "array"){
					$this->options = array_merge($this->options, $args[0]);
					return $this;
				}
				return $this->options[$args[0]];
			case 0:
				return $this->options;
			default: break;
		}
		return $this;
	}

	/**
	 * Get spreadsheet data by the mode
	 *
	 * @param {String} $key
	 * @param {String} $mode
	 * @return {Array}
	 */
	public function get($key, $mode = "load"){
		if(! in_array($mode, $this->modes)){
			throw new Exception("Unknown mode: {$mode}");
		}
		return $this->$mode($key);
	}

	/**
	 * mode: load
	 * ----------
	 * If cache is alive, return cache data
	 * If not, fetch new data and update cache, return the data
	 *
	 * @param {String} $key
	 * @return {Array}
	 */
	public function load($key){
		$data = $this->_cache($key);
		if(! $data){
			$data = $this->fetch($key);
			$this->_cache($key, $data);
		}
		return $data;
	}

	/**
	 * mode: fetch
	 * -----------
	 * Forceley fetch new data from remote, return it
	 * This doesn't save any cache data
	 * 
	 * @param {String} $key
	 * @return {Array}
	 */
	public function fetch($key){
		$url = sprintf($this->config("url"), $key);
		$content = $this->_curl($url, $this->config("timeout"));
		return $this->_parse($key, $content);
	}

	/**
	 * mode: cache
	 * -----------
	 * Forcely get cache data
	 * 
	 * @param {String} $key
	 * @return {Array}
	 */
	public function cache($key){
		return $this->_cache($key, null, true);
	}

	/**
	 * mode: update
	 * ------------
	 * Update cache data by fetching remote data
	 *
	 * @param {String} $key
	 * @return {Array}
	 */
	public function update($key){
		$data = $this->fetch($key);
		return $this->_cache($key, $data, true);
	}

	/**
	 * Ajax action
	 * -----------
	 * Interface for Ajax Request
	 * vars:
	 *   - {String} mode
	 *   - {String} key
	 *
	 * @param {Array} $vars
	 */
	public function ajax($vars = null){
		$vars = array_merge(array(
			"mode" => "load",
			"key" => null
		), $vars ? $vars : $_GET);


		try {

			header("Content-Type: application/json; charset=utf-8");

			if(! in_array($vars["mode"], $this->modes)){
				throw new Exception(self::ERROR_INVALID_MODE);
			}
			$mode = $vars["mode"];
			$data = $this->$mode($vars["key"]);
			if(! $data){
				throw new Exception(self::ERROR_NOT_FOUND);
			}
			echo json_encode(array(
				"status" => "success",
				"data" => $data
			));

		} catch(Exception $e){

			$message = $e->getMessage();
			switch($message){
				case self::ERROR_INVALID_MODE:
				case self::ERROR_NOT_FOUND:
					break;
				default: 
					$message = "Unknown error";
					break;
			}
			header("HTTP/1.1 500 Internal Server Error");
			echo json_encode(array(
				"status" => "error",
				"message" => $message
			));

		}

		return $this;
	}

	/**
	 * Get or save cache
	 *
	 * @param {String} $key
	 * @param {Array} $data
	 * @param {Boolean} $force
	 * @return {Array}
	 */
	private function _cache($key, $data = null, $force = false){
		$file = implode("/", array(
			$this->config("cache_dir"),
			urlencode($key) . $this->config("cache_suffix")
		));
		$exists = file_exists($file);

		// If data is not passed, try to get cache data (if exists or alive)
		if(! $data){
			if(! $exists){
				return null;
			}
			// check lifetime
			$expires = (time() - filemtime($file)) > $this->config("cache_lifetime");
			if($force || ! $expires){
				return json_decode(file_get_contents($file), true);
			}
			return null;
		}

		// If data is passed, save it as cache file
		if($exists && ! is_writable($file)){
			chmod($file, 0666);
		}
		file_put_contents($file, json_encode($data));
		return $data;
	}

	/**
	 * Parse fetched HTML content
	 *
	 * @param {String} $key
	 * @param {String} $content
	 * @return {Array}
	 */
	private function _parse($key, $content){
		if(! $content){
			return null;
		}

		$dom = new DOMDocument();
		$dom->loadHTMl($content);
		$data = array(
			"title" => null,
			"key" => $key,
			"sheets" => array()
		);

		// parse title
		$data["title"] = $dom->getElementById("doc-title")->nodeValue;

		// parse menu
		$menu = $dom->getElementById("sheet-menu");
		foreach($menu->getElementsByTagName("a") as $link){

			$sheet = array(
				"id" => null,
				"title" => null,
				"fields" => null,
				"items" => array()
			);

			// parse title
			$id = $this->_match("/\('(\w+)'\)/", $link->getAttribute("onclick"), 1);
			$sheet["id"] = $id;
			$sheet["title"] = $link->nodeValue;
			$fields = null;

			// parse table
			foreach($dom->getElementById($id)->getElementsByTagName("tr") as $row){

				$item = array();
				$cols = array();

				foreach($row->getElementsByTagName("td") as $col){
					array_push($cols, $col->nodeValue);
				}
				if(! $cols || ! implode("", $cols)){
					continue;
				}

				// parse fields
				if(! $sheet["fields"]){
					$sheet["fields"] = array_map(function($name){
						return explode(":", $name);
					}, $cols);
					continue;
				}

				// parse cols
				foreach($sheet["fields"] as $i => $field){
					$item[$field[0]] = $this->_parseByType($this->_get($i, $cols), $this->_get(1, $field));
				}
				array_push($sheet["items"], $item);
			}
			array_push($data["sheets"], $sheet);
		}

		return $data;
	}

	/**
	 * Fetch remote file by curl
	 * 
	 * @param {String} $url
	 * @param {Integer} $timeout
	 * @return {String}
	 */
	private function _curl($url, $timeout){
		$ch = curl_init();
		curl_setopt($ch, CURLOPT_URL, $url);
		curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
		curl_setopt($ch, CURLOPT_FAILONERROR, true);
		curl_setopt($ch, CURLOPT_TIMEOUT, $timeout);
		$res = curl_exec($ch);
		curl_close($ch);
		return $res;
	}

	/**
	 * Get matched value by index
	 * 
	 * @param {String} $pattern
	 * @param {String} $str
	 * @param {Integer} $index
	 * @return {String}
	 */
	private function _match($pattern, $str, $index = 0){
		if(preg_match($pattern, $str, $m)){
			return $m[$index];
		}
		return null;
	}

	/**
	 * Get value from array by key
	 *
	 * @param {String|Integer} $key
	 * @param {Array} $vars
	 * @param {*} $default
	 * @return {*}
	 */
	private function _get($key, $vars, $default = null){
		if(array_key_exists($key, $vars)){
			return $vars[$key];
		}
		return $default;
	}

	/**
	 * Juggle value by type name
	 *
	 * @param {String} $value
	 * @param {String} $type
	 * @return {*}
	 */
	private function _parseByType($value, $type){
		$type = $type ? $type : "string";
		switch($type){
			case "integer":
			case "int":
				return (integer) $value;
			case "float":
			case "double":
				return (float) $value;
			case "boolean":
			case "bool":
				return !! preg_match("/^true$/i", $value);
			case "json":
				return json_decode($value);
			default: break;
		}
		return $value;
	}

}