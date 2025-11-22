'use client';

import { useState } from 'react';
import { Calendar, Bell, Mail, Download, Plus, X } from 'lucide-react';
import { format, addDays } from 'date-fns';

interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  date: Date;
  type: 'delivery' | 'approval' | 'shipment' | 'reminder';
  poNumber?: string;
  status: 'upcoming' | 'today' | 'overdue';
}

interface CalendarIntegrationProps {
  pos?: any[];
  onAddReminder?: (event: Omit<CalendarEvent, 'id'>) => void;
}

export default function CalendarIntegration({ pos = [], onAddReminder }: CalendarIntegrationProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([
    // TODO: Fetch real events from Firestore based on PO dates
  ]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());

  const exportToGoogleCalendar = (event: CalendarEvent) => {
    const startDate = format(event.date, "yyyyMMdd'T'HHmmss");
    const endDate = format(addDays(event.date, 0), "yyyyMMdd'T'HHmmss");
    const details = encodeURIComponent(event.description);
    const title = encodeURIComponent(event.title);
    
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startDate}/${endDate}&details=${details}`;
    window.open(url, '_blank');
  };

  const exportToICS = (event: CalendarEvent) => {
    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART:${format(event.date, "yyyyMMdd'T'HHmmss")}
DTEND:${format(addDays(event.date, 0), "yyyyMMdd'T'HHmmss")}
SUMMARY:${event.title}
DESCRIPTION:${event.description}
END:VEVENT
END:VCALENDAR`;

    const blob = new Blob([icsContent], { type: 'text/calendar' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${event.title.replace(/\s+/g, '-')}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case 'delivery': return 'bg-blue-50 text-blue-600 border-blue-200';
      case 'approval': return 'bg-yellow-50 text-yellow-600 border-yellow-200';
      case 'shipment': return 'bg-purple-50 text-purple-600 border-purple-200';
      case 'reminder': return 'bg-green-50 text-green-600 border-green-200';
      default: return 'bg-gray-50 text-gray-600 border-gray-200';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'today':
        return <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">Today</span>;
      case 'overdue':
        return <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">Overdue</span>;
      case 'upcoming':
        return <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">Upcoming</span>;
      default:
        return null;
    }
  };

  const sortedEvents = [...events].sort((a, b) => a.date.getTime() - b.date.getTime());

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Calendar className="size-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Delivery Calendar</h3>
          </div>
          
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
          >
            <Plus className="size-4" />
            <span>Add Reminder</span>
          </button>
        </div>
      </div>

      <div className="p-4">
        {/* Calendar View */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-gray-900">
              {format(selectedDate, 'MMMM yyyy')}
            </h4>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setSelectedDate(new Date(selectedDate.setMonth(selectedDate.getMonth() - 1)))}
                className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Previous
              </button>
              <button
                onClick={() => setSelectedDate(new Date())}
                className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Today
              </button>
              <button
                onClick={() => setSelectedDate(new Date(selectedDate.setMonth(selectedDate.getMonth() + 1)))}
                className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>

        {/* Events List */}
        <div className="space-y-3">
          <h4 className="font-semibold text-gray-900 mb-3">Upcoming Events</h4>
          
          {sortedEvents.map((event) => (
            <div
              key={event.id}
              className={`p-4 rounded-lg border ${getEventColor(event.type)} hover:shadow-md transition-shadow`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <h5 className="font-semibold text-gray-900">{event.title}</h5>
                    {getStatusBadge(event.status)}
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{event.description}</p>
                  
                  <div className="flex items-center space-x-4 text-xs text-gray-500">
                    <div className="flex items-center space-x-1">
                      <Calendar className="size-3" />
                      <span>{format(event.date, 'MMM dd, yyyy')}</span>
                    </div>
                    {event.poNumber && (
                      <span className="px-2 py-1 bg-white rounded border border-gray-300">
                        {event.poNumber}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-2 ml-4">
                  <button
                    onClick={() => exportToGoogleCalendar(event)}
                    className="p-2 text-gray-600 hover:bg-white rounded-lg transition-colors"
                    title="Add to Google Calendar"
                  >
                    <Calendar className="size-4" />
                  </button>
                  <button
                    onClick={() => exportToICS(event)}
                    className="p-2 text-gray-600 hover:bg-white rounded-lg transition-colors"
                    title="Download ICS"
                  >
                    <Download className="size-4" />
                  </button>
                  <button
                    className="p-2 text-gray-600 hover:bg-white rounded-lg transition-colors"
                    title="Set Email Reminder"
                  >
                    <Mail className="size-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {sortedEvents.length === 0 && (
            <div className="text-center p-8 text-gray-500">
              <Calendar className="size-8 mx-auto mb-2 text-gray-300" />
              <p>No upcoming events</p>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h4 className="font-semibold text-gray-900 mb-3">Quick Actions</h4>
          <div className="grid grid-cols-2 gap-3">
            <button className="flex items-center justify-center space-x-2 px-4 py-3 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors">
              <Bell className="size-4" />
              <span className="text-sm font-medium">Enable Notifications</span>
            </button>
            <button className="flex items-center justify-center space-x-2 px-4 py-3 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors">
              <Mail className="size-4" />
              <span className="text-sm font-medium">Email Reminders</span>
            </button>
          </div>
        </div>
      </div>

      {/* Add Reminder Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setShowAddModal(false)} />
          
          <div className="relative min-h-screen flex items-center justify-center p-4">
            <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md">
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Add Calendar Reminder</h3>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                >
                  <X className="size-5" />
                </button>
              </div>

              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
                  <input
                    type="text"
                    placeholder="Reminder title"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="delivery">Delivery</option>
                    <option value="approval">Approval</option>
                    <option value="shipment">Shipment</option>
                    <option value="reminder">General Reminder</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                  <textarea
                    rows={3}
                    placeholder="Add details..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <button
                  onClick={() => setShowAddModal(false)}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Add Reminder
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
