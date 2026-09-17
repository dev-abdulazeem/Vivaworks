import React from 'react';
import { useParams } from 'react-router-dom';
import AudioRoomPlayer from '../components/audio/AudioRoomPlayer';

const AudioRoom = () => {
  const { id } = useParams();

  return <AudioRoomPlayer roomId={id} />;
};

export default AudioRoom;