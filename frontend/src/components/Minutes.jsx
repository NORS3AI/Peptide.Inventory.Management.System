import { useState, useEffect } from 'react';
import { db } from '../lib/db';
import { X, Plus, Trash2, Calendar, Users, CheckCircle, Circle, Edit2, Save } from 'lucide-react';

export default function Minutes({ onClose }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [meetings, setMeetings] = useState([]);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showNewMeeting, setShowNewMeeting] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState(null);

  // New meeting form
  const [newMeeting, setNewMeeting] = useState({
    title: '',
    meetingDate: new Date().toISOString().slice(0, 16),
    notes: '',
    attendees: '',
    actionItems: []
  });

  // Action item form
  const [newActionItem, setNewActionItem] = useState({ member: '', task: '' });
  const [editActionItem, setEditActionItem] = useState({ member: '', task: '' });

  // Check authentication on mount
  useEffect(() => {
    const isAuth = sessionStorage.getItem('minutesAuth') === 'true';
    if (isAuth) {
      setAuthenticated(true);
      loadMeetings();
    }
  }, []);

  // Load meetings
  const loadMeetings = async () => {
    setLoading(true);
    try {
      const allMeetings = await db.minutes.getAll();
      setMeetings(allMeetings);
    } catch (error) {
      console.error('Error loading meetings:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle password submit
  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    if (password === '1337') {
      setAuthenticated(true);
      sessionStorage.setItem('minutesAuth', 'true');
      setError('');
      loadMeetings();
    } else {
      setError('Invalid password');
      setPassword('');
    }
  };

  // Create new meeting
  const handleCreateMeeting = async () => {
    if (!newMeeting.title.trim()) return;

    try {
      const attendeesList = newMeeting.attendees.split(',').map(a => a.trim()).filter(a => a);
      await db.minutes.create({
        ...newMeeting,
        attendees: attendeesList
      });

      setNewMeeting({
        title: '',
        meetingDate: new Date().toISOString().slice(0, 16),
        notes: '',
        attendees: '',
        actionItems: []
      });
      setShowNewMeeting(false);
      await loadMeetings();
    } catch (error) {
      console.error('Error creating meeting:', error);
    }
  };

  // Update meeting
  const handleUpdateMeeting = async (id, updates) => {
    try {
      await db.minutes.update(id, updates);
      await loadMeetings();
      setSelectedMeeting(null);
    } catch (error) {
      console.error('Error updating meeting:', error);
    }
  };

  // Delete meeting
  const handleDeleteMeeting = async (id) => {
    if (!confirm('Delete this meeting?')) return;

    try {
      await db.minutes.delete(id);
      await loadMeetings();
      setSelectedMeeting(null);
    } catch (error) {
      console.error('Error deleting meeting:', error);
    }
  };

  // Add action item
  const handleAddActionItem = () => {
    if (!newActionItem.member.trim() || !newActionItem.task.trim()) return;

    setNewMeeting({
      ...newMeeting,
      actionItems: [
        ...newMeeting.actionItems,
        { ...newActionItem, completed: false }
      ]
    });
    setNewActionItem({ member: '', task: '' });
  };

  // Toggle action item completion
  const handleToggleActionItem = async (meeting, itemIndex) => {
    const updated = [...meeting.actionItems];
    updated[itemIndex].completed = !updated[itemIndex].completed;
    await handleUpdateMeeting(meeting.id, { actionItems: updated });
  };

  // Delete action item (for new meeting)
  const handleDeleteActionItem = (index) => {
    setNewMeeting({
      ...newMeeting,
      actionItems: newMeeting.actionItems.filter((_, i) => i !== index)
    });
  };

  // Start editing a meeting
  const handleStartEdit = (meeting) => {
    setEditingMeeting({
      ...meeting,
      meetingDate: new Date(meeting.meetingDate).toISOString().slice(0, 16),
      attendees: meeting.attendees.join(', ')
    });
  };

  // Save edited meeting
  const handleSaveEdit = async () => {
    if (!editingMeeting.title.trim()) return;

    try {
      const attendeesList = editingMeeting.attendees.split(',').map(a => a.trim()).filter(a => a);
      await db.minutes.update(editingMeeting.id, {
        title: editingMeeting.title,
        meetingDate: editingMeeting.meetingDate,
        notes: editingMeeting.notes,
        attendees: attendeesList,
        actionItems: editingMeeting.actionItems
      });
      setEditingMeeting(null);
      await loadMeetings();
    } catch (error) {
      console.error('Error updating meeting:', error);
    }
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setEditingMeeting(null);
    setEditActionItem({ member: '', task: '' });
  };

  // Add action item to editing meeting
  const handleAddEditActionItem = () => {
    if (!editActionItem.member.trim() || !editActionItem.task.trim()) return;

    setEditingMeeting({
      ...editingMeeting,
      actionItems: [
        ...editingMeeting.actionItems,
        { ...editActionItem, completed: false }
      ]
    });
    setEditActionItem({ member: '', task: '' });
  };

  // Delete action item from editing meeting
  const handleDeleteEditActionItem = (index) => {
    setEditingMeeting({
      ...editingMeeting,
      actionItems: editingMeeting.actionItems.filter((_, i) => i !== index)
    });
  };

  // Password gate
  if (!authenticated) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Team Minutes</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Enter Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password..."
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoFocus
              />
              {error && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
              )}
            </div>

            <button
              type="submit"
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Unlock
            </button>
          </form>

          <p className="mt-4 text-xs text-center text-gray-500 dark:text-gray-400">
            Protected meeting minutes for team members only
          </p>
        </div>
      </div>
    );
  }

  // Main minutes interface
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-6xl w-full max-h-[95vh] overflow-hidden flex flex-col my-4">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Team Meeting Minutes</h2>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowNewMeeting(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Meeting
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-gray-500 dark:text-gray-400">Loading meetings...</div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* New Meeting Form */}
              {showNewMeeting && (
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg border-2 border-blue-500 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">New Meeting</h3>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Meeting Title *
                        </label>
                        <input
                          type="text"
                          value={newMeeting.title}
                          onChange={(e) => setNewMeeting({ ...newMeeting, title: e.target.value })}
                          placeholder="e.g., Weekly Team Sync"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Meeting Date & Time
                        </label>
                        <input
                          type="datetime-local"
                          value={newMeeting.meetingDate}
                          onChange={(e) => setNewMeeting({ ...newMeeting, meetingDate: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Attendees (comma-separated)
                      </label>
                      <input
                        type="text"
                        value={newMeeting.attendees}
                        onChange={(e) => setNewMeeting({ ...newMeeting, attendees: e.target.value })}
                        placeholder="e.g., John, Sarah, Mike"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Meeting Notes
                      </label>
                      <textarea
                        value={newMeeting.notes}
                        onChange={(e) => setNewMeeting({ ...newMeeting, notes: e.target.value })}
                        placeholder="What happened in the meeting? Discussion points, decisions made, etc."
                        rows={8}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm"
                      />
                    </div>

                    {/* Action Items */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Action Items
                      </label>
                      <div className="space-y-2">
                        {newMeeting.actionItems.map((item, index) => (
                          <div key={index} className="flex items-center gap-2 p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                            <Circle className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            <div className="flex-1">
                              <span className="font-medium text-gray-900 dark:text-white">{item.member}:</span>
                              <span className="ml-2 text-gray-700 dark:text-gray-300">{item.task}</span>
                            </div>
                            <button
                              onClick={() => handleDeleteActionItem(index)}
                              className="text-red-600 hover:text-red-700 dark:text-red-400"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}

                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={newActionItem.member}
                            onChange={(e) => setNewActionItem({ ...newActionItem, member: e.target.value })}
                            placeholder="Team member"
                            className="w-1/3 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                          />
                          <input
                            type="text"
                            value={newActionItem.task}
                            onChange={(e) => setNewActionItem({ ...newActionItem, task: e.target.value })}
                            placeholder="Task to complete"
                            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                          />
                          <button
                            onClick={handleAddActionItem}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-3 justify-end pt-4">
                      <button
                        onClick={() => setShowNewMeeting(false)}
                        className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleCreateMeeting}
                        disabled={!newMeeting.title.trim()}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Create Meeting
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Meetings List */}
              {meetings.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <p className="text-gray-500 dark:text-gray-400">No meetings recorded yet. Create your first meeting above!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {meetings.map((meeting) => {
                    const isEditing = editingMeeting?.id === meeting.id;

                    return (
                    <div
                      key={meeting.id}
                      className="bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 p-6 hover:shadow-md transition-shadow"
                    >
                      {isEditing ? (
                        // Edit Mode
                        <div className="space-y-4">
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Edit Meeting</h3>
                            <div className="flex gap-2">
                              <button
                                onClick={handleSaveEdit}
                                className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                              >
                                <Save className="w-4 h-4" />
                                Save
                              </button>
                              <button
                                onClick={handleCancelEdit}
                                className="px-3 py-1 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-500 text-sm"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Meeting Title *
                              </label>
                              <input
                                type="text"
                                value={editingMeeting.title}
                                onChange={(e) => setEditingMeeting({ ...editingMeeting, title: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Meeting Date & Time
                              </label>
                              <input
                                type="datetime-local"
                                value={editingMeeting.meetingDate}
                                onChange={(e) => setEditingMeeting({ ...editingMeeting, meetingDate: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Attendees (comma-separated)
                            </label>
                            <input
                              type="text"
                              value={editingMeeting.attendees}
                              onChange={(e) => setEditingMeeting({ ...editingMeeting, attendees: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Meeting Notes
                            </label>
                            <textarea
                              value={editingMeeting.notes}
                              onChange={(e) => setEditingMeeting({ ...editingMeeting, notes: e.target.value })}
                              rows={8}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Action Items
                            </label>
                            <div className="space-y-2">
                              {editingMeeting.actionItems.map((item, index) => (
                                <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                                  <Circle className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                  <div className="flex-1">
                                    <span className="font-medium text-gray-900 dark:text-white">{item.member}:</span>
                                    <span className="ml-2 text-gray-700 dark:text-gray-300">{item.task}</span>
                                  </div>
                                  <button
                                    onClick={() => handleDeleteEditActionItem(index)}
                                    className="text-red-600 hover:text-red-700 dark:text-red-400"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              ))}

                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={editActionItem.member}
                                  onChange={(e) => setEditActionItem({ ...editActionItem, member: e.target.value })}
                                  placeholder="Team member"
                                  className="w-1/3 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                                />
                                <input
                                  type="text"
                                  value={editActionItem.task}
                                  onChange={(e) => setEditActionItem({ ...editActionItem, task: e.target.value })}
                                  placeholder="Task to complete"
                                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                                />
                                <button
                                  onClick={handleAddEditActionItem}
                                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                                >
                                  Add
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        // View Mode
                        <>
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex-1">
                              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                                {meeting.title}
                              </h3>
                              <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                                <div className="flex items-center gap-1">
                                  <Calendar className="w-4 h-4" />
                                  {new Date(meeting.meetingDate).toLocaleString()}
                                </div>
                                {meeting.attendees.length > 0 && (
                                  <div className="flex items-center gap-1">
                                    <Users className="w-4 h-4" />
                                    {meeting.attendees.join(', ')}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleStartEdit(meeting)}
                                className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                              >
                                <Edit2 className="w-5 h-5" />
                              </button>
                              <button
                                onClick={() => handleDeleteMeeting(meeting.id)}
                                className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                              >
                                <Trash2 className="w-5 h-5" />
                              </button>
                            </div>
                          </div>

                          {meeting.notes && (
                            <div className="mb-4">
                              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Meeting Notes:</h4>
                              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                                <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap font-mono text-sm">
                                  {meeting.notes}
                                </p>
                              </div>
                            </div>
                          )}

                          {meeting.actionItems && meeting.actionItems.length > 0 && (
                            <div>
                              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Action Items:</h4>
                              <div className="space-y-2">
                                {meeting.actionItems.map((item, index) => (
                                  <div
                                    key={index}
                                    className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                                  >
                                    <button
                                      onClick={() => handleToggleActionItem(meeting, index)}
                                      className="flex-shrink-0"
                                    >
                                      {item.completed ? (
                                        <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                                      ) : (
                                        <Circle className="w-5 h-5 text-gray-400" />
                                      )}
                                    </button>
                                    <div className="flex-1">
                                      <span className={`font-medium ${item.completed ? 'text-gray-500 line-through' : 'text-gray-900 dark:text-white'}`}>
                                        {item.member}:
                                      </span>
                                      <span className={`ml-2 ${item.completed ? 'text-gray-400 line-through' : 'text-gray-700 dark:text-gray-300'}`}>
                                        {item.task}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
