export class MapModule {
  constructor(mapElementId) {
    this.mapElementId = mapElementId;
    this.map = null;
    this.carMarker = null;
    this.routePolyline = null;
    this.landmarkMarkers = {}; // id -> google.maps.Marker
  }

  /**
   * Google Maps APIスクリプトを動的にロードし、マップを初期化する
   * @param {string} apiKey 
   * @param {Array} landmarks ランドマーク情報
   */
  async init(apiKey, landmarks) {
    return new Promise((resolve, reject) => {
      if (window.google && window.google.maps) {
        this._setupMap(landmarks);
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry`;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        this._setupMap(landmarks);
        resolve();
      };
      script.onerror = (e) => reject(e);
      document.head.appendChild(script);
    });
  }

  _setupMap(landmarks) {
    // 地図の初期化（一旦鎌倉駅中心に設定）
    const initialPos = { lat: 35.3190, lng: 139.5505 };

    this.map = new google.maps.Map(document.getElementById(this.mapElementId), {
      center: initialPos,
      zoom: 14,
      disableDefaultUI: true,
      styles: [
        { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
        { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
        { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
        {
          featureType: "road",
          elementType: "geometry",
          stylers: [{ color: "#38414e" }]
        },
        {
          featureType: "road",
          elementType: "geometry.stroke",
          stylers: [{ color: "#212a37" }]
        },
        {
          featureType: "water",
          elementType: "geometry",
          stylers: [{ color: "#17263c" }]
        }
      ]
    });

    // 自車アイコンの描画（初期位置は見えない場所に一旦置くか、のちに設定）
    this.carMarker = new google.maps.Marker({
      position: initialPos,
      map: this.map,
      icon: {
        path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
        scale: 6,
        fillColor: '#22c55e', // success-color
        fillOpacity: 1,
        strokeWeight: 2,
        strokeColor: '#ffffff',
        rotation: 0 // 初期角度
      },
      zIndex: 100
    });

    // ランドマークマーカーの初期化
    landmarks.forEach(lm => {
      this.landmarkMarkers[lm.id] = new google.maps.Marker({
        position: lm.position,
        map: this.map,
        title: lm.name,
        icon: lm.iconUrl
      });
    });
  }

  /**
   * Directions APIを使用して詳細な経路パス座標（道路に沿った配列）を取得する
   */
  async calculateRoute(origin, destination, waypoints) {
    const directionsService = new google.maps.DirectionsService();
    return new Promise((resolve, reject) => {
      directionsService.route({
        origin: origin,
        destination: destination,
        waypoints: waypoints,
        travelMode: google.maps.TravelMode.DRIVING
      }, (response, status) => {
        if (status === 'OK') {
          // overview_path から緯度経度オブジェクトの配列を生成
          const path = response.routes[0].overview_path.map(p => ({
            lat: p.lat(),
            lng: p.lng()
          }));
          resolve(path);
        } else {
          reject('Directions請求に失敗しました: ' + status);
        }
      });
    });
  }

  /**
   * 詳細なルートパスを描画し、地図の表示領域をルートに合わせる
   */
  drawRoute(detailedPath) {
    if (!detailedPath || detailedPath.length === 0) return;
    
    // Bounds計算
    const bounds = new google.maps.LatLngBounds();
    detailedPath.forEach(p => bounds.extend(new google.maps.LatLng(p.lat, p.lng)));
    this.map.fitBounds(bounds);

    // 既存の線があれば消す
    if (this.routePolyline) {
      this.routePolyline.setMap(null);
    }

    this.routePolyline = new google.maps.Polyline({
      path: detailedPath,
      geodesic: true,
      strokeColor: '#0ea5e9', // primary-color
      strokeOpacity: 0.8,
      strokeWeight: 6
    });
    this.routePolyline.setMap(this.map);
  }

  /**
   * 車の現在位置と向き（進行方向）を更新する
   * @param {Object} position {lat, lng}
   * @param {Object} nextPosition 次の目標座標 {lat, lng}
   */
  updateCarPosition(position, nextPosition = null) {
    if (!this.carMarker) return;
    
    // アイコンの向きを計算
    let heading = 0;
    if (nextPosition && position) {
      heading = google.maps.geometry.spherical.computeHeading(
        new google.maps.LatLng(position.lat, position.lng),
        new google.maps.LatLng(nextPosition.lat, nextPosition.lng)
      );
    }

    this.carMarker.setPosition(position);
    
    if (nextPosition) {
      const icon = this.carMarker.getIcon();
      icon.rotation = heading;
      this.carMarker.setIcon(icon);
    }
  }

  /**
   * ランドマークを強調表示（点滅アニメーション）する
   * 実際にはDOMアクセスが煩雑になるためGoogle Mapsの場合はマーカーのバウンス効果等を使用
   */
  highlightLandmark(id) {
    const marker = this.landmarkMarkers[id];
    if (marker) {
      marker.setAnimation(google.maps.Animation.BOUNCE);
      setTimeout(() => {
        marker.setAnimation(null);
      }, 5000); // 5秒で点滅停止
    }
  }
}
