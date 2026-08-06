import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import type { NearbyPost } from '../../lib/mock-api';

const LATITUDE_DELTA = 0.01;
const LONGITUDE_DELTA = 0.01;

type GoogleMapViewProps = {
  center: { lat: number; lng: number };
  posts: NearbyPost[];
  onPressPost: (postId: string) => void;
};

export function GoogleMapView({ center, posts, onPressPost }: GoogleMapViewProps) {
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    mapRef.current?.animateToRegion(
      {
        latitude: center.lat,
        longitude: center.lng,
        latitudeDelta: LATITUDE_DELTA,
        longitudeDelta: LONGITUDE_DELTA,
      },
      300,
    );
  }, [center]);

  return (
    <MapView
      ref={mapRef}
      style={styles.map}
      initialRegion={{
        latitude: center.lat,
        longitude: center.lng,
        latitudeDelta: LATITUDE_DELTA,
        longitudeDelta: LONGITUDE_DELTA,
      }}
    >
      <Marker coordinate={{ latitude: center.lat, longitude: center.lng }}>
        <View style={styles.currentLocationDot} />
      </Marker>

      {posts.map((post) => (
        <Marker key={post.id} coordinate={{ latitude: post.lat, longitude: post.lng }} onPress={() => onPressPost(post.id)}>
          <View style={styles.pin}>
            <Text style={styles.pinEmoji}>{post.genreEmoji}</Text>
          </View>
        </Marker>
      ))}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
  currentLocationDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#4a9eff',
    borderWidth: 3,
    borderColor: '#fff',
  },
  pin: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pinEmoji: {
    fontSize: 20,
  },
});
