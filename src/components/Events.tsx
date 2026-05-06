import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Calendar, MapPin, Clock, Plus, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase, Event } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { EventModal } from './EventModal';


export const Events = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { user } = useAuth();


  useEffect(() => {
    fetchEvents();
  }, []);


  const fetchEvents = async () => {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .gte('event_date', new Date().toISOString().split('T')[0])
      .order('event_date', { ascending: true });


    if (!error && data) {
      setEvents(data);
    }
    setLoading(false);
  };


  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };


  const formatTime = (timeString: string | null) => {
    if (!timeString) return null;
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };


  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };


  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 },
