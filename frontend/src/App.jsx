import { useEffect, useState } from 'react';
import axios from 'axios';
import './App.css';

const API = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/$/, '');

const SERVER_URL = API.replace(/\/api$/, '');

function getArray(data, keys = []) {
  if (Array.isArray(data)) return data;

  for (const key of keys) {
    if (Array.isArray(data?.[key])) return data[key];
  }

  if (Array.isArray(data?.value)) return data.value;

  return [];
}

function getPhotoUrl(photo) {
  if (!photo) return null;

  if (photo.startsWith('http://') || photo.startsWith('https://')) {
    return photo;
  }

  return `${SERVER_URL}${photo.startsWith('/') ? '' : '/'}${photo}`;
}

function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');

  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || 'null');
    } catch {
      return null;
    }
  });

  const [page, setPage] = useState('home');

  const [items, setItems] = useState([]);
  const [myReports, setMyReports] = useState([]);
  const [myClaims, setMyClaims] = useState([]);

  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [itemType, setItemType] = useState('ALL');

  const [editingId, setEditingId] = useState(null);

  const [selectedItem, setSelectedItem] = useState(null);

  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');

  const [form, setForm] = useState({
    full_name: '',
    email: '',
    password: ''
  });

  const emptyReport = {
    report_type: 'LOST',
    title: '',
    category: '',
    description: '',
    private_details: '',
    item_date: '',
    campus_location: ''
  };

  const [report, setReport] = useState(emptyReport);

  const [claim, setClaim] = useState({
    itemId: '',
    evidence: ''
  });

  const headers = {
    Authorization: 'Bearer ' + token
  };

  // CLEAN UP IMAGE PREVIEWS

  useEffect(() => {
    return () => {
      if (photoPreview && photoPreview.startsWith('blob:')) {
        URL.revokeObjectURL(photoPreview);
      }
    };
  }, [photoPreview]);

  // LOAD PUBLIC ITEMS

  async function loadItems() {
    try {
      const response = await axios.get(`${API}/items`);
      setItems(getArray(response.data, ['items']));
    } catch (error) {
      setItems([]);
      setMessage('Unable to load public reports.');
    }
  }

  // LOAD STUDENT REPORTS AND CLAIMS

  async function loadMyData() {
    if (!token) return;

    try {
      const [reports, claims] = await Promise.all([
        axios.get(`${API}/items/my-reports`, { headers }),
        axios.get(`${API}/claims/my-claims`, { headers })
      ]);

      setMyReports(getArray(reports.data, ['reports', 'items']));
      setMyClaims(getArray(claims.data, ['claims']));
    } catch (error) {
      setMessage('Unable to load your dashboard.');
    }
  }

  useEffect(() => {
    loadItems();
    loadMyData();
  }, [token]);

  // REGISTRATION

  async function register(e) {
    e.preventDefault();
    setLoading(true);

    try {
      await axios.post(`${API}/auth/register`, form);

      setMessage('Registration successful. Please log in.');
      setForm({ ...form, password: '' });
      setPage('login');
    } catch (error) {
      setMessage(error.response?.data?.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  }

  // LOGIN

  async function login(e) {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await axios.post(`${API}/auth/login`, {
        email: form.email,
        password: form.password
      });

      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));

      setToken(response.data.token);
      setUser(response.data.user);
      setPage('dashboard');
      setMessage('Login successful.');

      setForm({
        full_name: '',
        email: '',
        password: ''
      });
    } catch (error) {
      setMessage(error.response?.data?.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  }

  // LOGOUT

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');

    setToken('');
    setUser(null);
    setMyReports([]);
    setMyClaims([]);
    setPage('home');

    setMessage('You have logged out successfully.');
  }

  // RESET PHOTO

  function resetPhoto() {
    setPhoto(null);
    setPhotoPreview('');
  }

  // OPEN REPORT FORM

  function openReport(type) {
    setEditingId(null);
    setReport({
      ...emptyReport,
      report_type: type
    });

    resetPhoto();
    setMessage('');

    if (!token) {
      setMessage('Please log in before reporting an item.');
      setPage('login');
      return;
    }

    setPage('report');
  }

  // SELECT PHOTO

  function handlePhotoChange(e) {
    const selectedFile = e.target.files?.[0];

    if (!selectedFile) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];

    if (!allowedTypes.includes(selectedFile.type)) {
      setMessage('Please select a JPG, PNG or WEBP image.');
      e.target.value = '';
      return;
    }

    if (selectedFile.size > 5 * 1024 * 1024) {
      setMessage('Image must not exceed 5MB.');
      e.target.value = '';
      return;
    }

    resetPhoto();

    setPhoto(selectedFile);
    setPhotoPreview(URL.createObjectURL(selectedFile));
    setMessage('');
  }

  // SUBMIT OR UPDATE REPORT

  async function submitReport(e) {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingId) {
        // Existing edit endpoint accepts JSON.
        // Photo replacement will require a separate backend update.

        await axios.patch(
          `${API}/items/${editingId}`,
          report,
          { headers }
        );

        setMessage('Report updated successfully.');

      } else {
        const formData = new FormData();

        Object.entries(report).forEach(([key, value]) => {
          formData.append(key, value);
        });

        if (photo) {
          formData.append('photo', photo);
        }

        await axios.post(
          `${API}/items`,
          formData,
          {
            headers: {
              Authorization: 'Bearer ' + token
            }
          }
        );

        setMessage(
          'Your report has been submitted for administrator review.'
        );
      }

      setReport(emptyReport);
      setEditingId(null);
      resetPhoto();

      await loadItems();
      await loadMyData();

      setPage('dashboard');

    } catch (error) {
      setMessage(
        error.response?.data?.message ||
        'Report submission failed.'
      );
    } finally {
      setLoading(false);
    }
  }

  // SUBMIT OWNERSHIP CLAIM

  async function submitClaim(e) {
    e.preventDefault();
    setLoading(true);

    try {
      await axios.post(
        `${API}/claims/${claim.itemId}`,
        { evidence: claim.evidence },
        { headers }
      );

      setMessage('Ownership claim submitted successfully.');

      setClaim({
        itemId: '',
        evidence: ''
      });

      await loadMyData();

      setPage('dashboard');

    } catch (error) {
      setMessage(
        error.response?.data?.message ||
        'Claim submission failed.'
      );
    } finally {
      setLoading(false);
    }
  }

  // EDIT REPORT

  function editReport(item) {
    setEditingId(item.id);

    setReport({
      report_type: item.report_type,
      title: item.title,
      category: item.category,
      description: item.description,
      private_details: item.private_details || '',
      item_date: String(item.item_date || '').slice(0, 10),
      campus_location: item.campus_location
    });

    resetPhoto();
    setPage('report');
  }

  // VIEW ITEM DETAILS

  function viewItem(item) {
    setSelectedItem(item);
    setPage('details');
  }

  // OPEN CLAIM FORM FOR AN ITEM

  function openClaim(item) {
    if (!token) {
      setMessage('Please log in to submit an ownership claim.');
      setPage('login');
      return;
    }

    setClaim({
      itemId: item.id,
      evidence: ''
    });

    setPage('claim');
  }

  // HOMEPAGE FILTERING

  const filteredItems = items.filter(item => {
    const matchesSearch = [
      item.title,
      item.category,
      item.campus_location,
      item.description
    ]
      .join(' ')
      .toLowerCase()
      .includes(search.toLowerCase());

    const matchesCategory =
      category === 'All' || item.category === category;

    const matchesType =
      itemType === 'ALL' || item.report_type === itemType;

    return matchesSearch && matchesCategory && matchesType;
  });

  const lostCount = items.filter(
    item => item.report_type === 'LOST'
  ).length;

  const foundCount = items.filter(
    item => item.report_type === 'FOUND'
  ).length;

  return (
    <div className="app-shell">

      {/* NAVIGATION */}

      <header className="navbar">

        <a
          className="brand"
          href="/"
          onClick={event => {
            event.preventDefault();
            setPage('home');
          }}
          aria-label="UCU Campus Lost and Found home"
        >
          <img
            src="/ucu-logo.png"
            alt="Uganda Christian University"
          />
        </a>

        <nav>

          <button onClick={() => setPage('home')}>
            Home
          </button>

          <button onClick={() => openReport('LOST')}>
            Report Lost Item
          </button>

          <button onClick={() => openReport('FOUND')}>
            Report Found Item
          </button>

          {token ? (
            <>
              <button onClick={() => setPage('dashboard')}>
                Dashboard
              </button>

              {user?.role === 'ADMIN' && (
                <button onClick={() => setPage('admin')}>
                  Admin
                </button>
              )}

              <button onClick={logout}>
                Logout
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setPage('login')}>
                Login
              </button>

              <button onClick={() => setPage('register')}>
                Register
              </button>
            </>
          )}

        </nav>
      </header>

      <main>

        {/* NOTIFICATIONS */}

        {message && (
          <div className="message" role="status">
            {message}

            <button onClick={() => setMessage('')}>
              Ã—
            </button>
          </div>
        )}

        {/* HOMEPAGE */}

        {page === 'home' && (
          <>

            <section className="found-hero">

              <div className="hero-content">

                <span className="hero-label">
                  UCU CAMPUS COMMUNITY
                </span>

                <h1>UCU CAMPUS LOST & FOUND</h1>

                <h2>Helping You Find What Matters</h2>

                <p>
                  A missing item can mean a lot. Report lost belongings,
                  share found items and help members of our university
                  community recover what belongs to them.
                </p>

                <div className="hero-buttons">

                  <button onClick={() => openReport('LOST')}>
                    Report Lost Item
                  </button>

                  <button onClick={() => openReport('FOUND')}>
                    Report Found Item
                  </button>

                </div>

              </div>

            </section>

            <section className="content">

              <div className="dashboard-stats">

                <div className="stat-card">
                  <h3>{items.length}</h3>
                  <p>Total Reports</p>
                </div>

                <div className="stat-card">
                  <h3>{lostCount}</h3>
                  <p>Lost Items</p>
                </div>

                <div className="stat-card">
                  <h3>{foundCount}</h3>
                  <p>Found Items</p>
                </div>

              </div>

              <div className="homepage-heading">

                <h2>Explore Reported Items</h2>

                <p>
                  Search through items reported by the UCU community.
                </p>

              </div>

              <div className="search-area">

                <input
                  type="search"
                  placeholder="Search by item name, description or location..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />

                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                >
                  <option value="All">All Categories</option>
                  <option value="Electronics">Electronics</option>
                  <option value="Documents">Documents</option>
                  <option value="Clothing">Clothing</option>
                  <option value="Bags">Bags</option>
                  <option value="Accessories">Accessories</option>
                  <option value="Other">Other</option>
                </select>

              </div>

              <div className="item-filters">

                <button
                  className={itemType === 'ALL' ? 'active-filter' : ''}
                  onClick={() => setItemType('ALL')}
                >
                  All Items
                </button>

                <button
                  className={itemType === 'LOST' ? 'active-filter' : ''}
                  onClick={() => setItemType('LOST')}
                >
                  Lost Items
                </button>

                <button
                  className={itemType === 'FOUND' ? 'active-filter' : ''}
                  onClick={() => setItemType('FOUND')}
                >
                  Found Items
                </button>

              </div>

              {/* ITEM CARDS */}

              <div className="grid">

                {filteredItems.map(item => (

                  <div className="card item-card" key={item.id}>

                    {item.photo_url ? (
                      <img
                        className="item-photo"
                        src={getPhotoUrl(item.photo_url)}
                        alt={item.title}
                      />
                    ) : (
                      <div className="no-item-photo">
                        No photo available
                      </div>
                    )}

                    <span className={
                      item.report_type === 'LOST'
                        ? 'item-badge lost-badge'
                        : 'item-badge found-badge'
                    }>
                      {item.report_type === 'LOST'
                        ? 'LOST ITEM'
                        : 'FOUND ITEM'}
                    </span>

                    <h3>{item.title}</h3>

                    <p>
                      <strong>Category:</strong> {item.category}
                    </p>

                    <p>
                      <strong>Location:</strong> {item.campus_location}
                    </p>

                    <p>
                      <strong>Description:</strong>{' '}
                      {item.description.length > 100
                        ? item.description.slice(0, 100) + '...'
                        : item.description}
                    </p>

                    <div className="item-card-actions">

                      <button
                        className="details-button"
                        onClick={() => viewItem(item)}
                      >
                        View Details
                      </button>

                      <button onClick={() => openClaim(item)}>
                        Submit Ownership Claim
                      </button>

                    </div>

                  </div>

                ))}

                {filteredItems.length === 0 && (
                  <div className="empty-dashboard">
                    <h3>No matching items found</h3>
                    <p>
                      Try another search term or category.
                    </p>
                  </div>
                )}

              </div>

            </section>

          </>
        )}

        {/* ITEM DETAILS PAGE */}

        {page === 'details' && selectedItem && (

          <section className="content details-page">

            <button
              className="back-button"
              onClick={() => setPage('home')}
            >
              â† Back to Items
            </button>

            <div className="details-container">

              <div className="details-image">

                {selectedItem.photo_url ? (
                  <img
                    src={getPhotoUrl(selectedItem.photo_url)}
                    alt={selectedItem.title}
                  />
                ) : (
                  <div className="no-item-photo large">
                    No photograph available
                  </div>
                )}

              </div>

              <div className="details-information">

                <span className={
                  selectedItem.report_type === 'LOST'
                    ? 'item-badge lost-badge'
                    : 'item-badge found-badge'
                }>
                  {selectedItem.report_type === 'LOST'
                    ? 'LOST ITEM'
                    : 'FOUND ITEM'}
                </span>

                <h2>{selectedItem.title}</h2>

                <p>
                  <strong>Category:</strong> {selectedItem.category}
                </p>

                <p>
                  <strong>Description:</strong>
                </p>

                <p>{selectedItem.description}</p>

                <p>
                  <strong>Location:</strong> {selectedItem.campus_location}
                </p>

                <p>
                  <strong>Date lost/found:</strong>{' '}
                  {String(selectedItem.item_date || '').slice(0, 10)}
                </p>

                <button onClick={() => openClaim(selectedItem)}>
                  Submit Ownership Claim
                </button>

              </div>

            </div>

          </section>

        )}

        {/* LOGIN AND REGISTRATION */}

        {(page === 'login' || page === 'register') && (

          <section className="form-container">

            <h2>
              {page === 'login'
                ? 'Student Login'
                : 'Create an Account'}
            </h2>

            <form onSubmit={page === 'login' ? login : register}>

              {page === 'register' && (
                <input
                  placeholder="Full name"
                  required
                  value={form.full_name}
                  onChange={e => setForm({
                    ...form,
                    full_name: e.target.value
                  })}
                />
              )}

              <input
                type="email"
                placeholder="Email address"
                required
                value={form.email}
                onChange={e => setForm({
                  ...form,
                  email: e.target.value
                })}
              />

              <input
                type="password"
                placeholder="Password"
                minLength="8"
                required
                value={form.password}
                onChange={e => setForm({
                  ...form,
                  password: e.target.value
                })}
              />

              <button disabled={loading}>
                {loading
                  ? 'Please wait...'
                  : page === 'login'
                    ? 'Login'
                    : 'Register'}
              </button>

            </form>

            <p>
              {page === 'login'
                ? "Don't have an account? "
                : 'Already registered? '}

              <button
                className="text-button"
                onClick={() => {
                  setMessage('');
                  setPage(
                    page === 'login' ? 'register' : 'login'
                  );
                }}
              >
                {page === 'login'
                  ? 'Register here'
                  : 'Login here'}
              </button>

            </p>

          </section>

        )}

        {/* REPORT FORM */}

        {page === 'report' && (

          <section className="form-container wide">

            <h2>
              {editingId
                ? 'Edit Your Report'
                : 'Report an Item'}
            </h2>

            <form onSubmit={submitReport}>

              <label>What are you reporting?</label>

              <select
                value={report.report_type}
                onChange={e => setReport({
                  ...report,
                  report_type: e.target.value
                })}
                disabled={!!editingId}
              >
                <option value="LOST">Lost Item</option>
                <option value="FOUND">Found Item</option>
              </select>

              <label>Item name</label>

              <input
                placeholder="e.g. Samsung phone, Student ID"
                required
                value={report.title}
                onChange={e => setReport({
                  ...report,
                  title: e.target.value
                })}
              />

              <label>Category</label>

              <select
                required
                value={report.category}
                onChange={e => setReport({
                  ...report,
                  category: e.target.value
                })}
              >
                <option value="">Select Category</option>
                <option value="Electronics">Electronics</option>
                <option value="Documents">Documents</option>
                <option value="Clothing">Clothing</option>
                <option value="Bags">Bags</option>
                <option value="Accessories">Accessories</option>
                <option value="Other">Other</option>
              </select>

              <label>Description</label>

              <textarea
                placeholder="Describe the item..."
                required
                value={report.description}
                onChange={e => setReport({
                  ...report,
                  description: e.target.value
                })}
              />

              <label>Private identifying details</label>

              <textarea
                placeholder="Details only the owner should know"
                value={report.private_details}
                onChange={e => setReport({
                  ...report,
                  private_details: e.target.value
                })}
              />

              <label>Date lost or found</label>

              <input
                type="date"
                required
                value={report.item_date}
                onChange={e => setReport({
                  ...report,
                  item_date: e.target.value
                })}
              />

              <label>Campus location</label>

              <input
                placeholder="e.g. UCU Library, Main Hall"
                required
                value={report.campus_location}
                onChange={e => setReport({
                  ...report,
                  campus_location: e.target.value
                })}
              />

              {/* PHOTO UPLOAD */}

              {!editingId && (
                <div className="photo-upload-section">

                  <label htmlFor="item-photo">
                    Upload Item Photograph
                  </label>

                  <p>
                    Select a clear picture of the lost or found item.
                    JPG, PNG and WEBP are accepted. Maximum size: 5MB.
                  </p>

                  <input
                    id="item-photo"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handlePhotoChange}
                  />

                  {photoPreview && (
                    <div className="photo-preview">

                      <img
                        src={photoPreview}
                        alt="Selected item preview"
                      />

                      <button
                        type="button"
                        className="remove-photo"
                        onClick={() => {
                          resetPhoto();

                          const input = document.getElementById('item-photo');

                          if (input) input.value = '';
                        }}
                      >
                        Remove Photo
                      </button>

                    </div>
                  )}

                </div>
              )}

              {editingId && (
                <p>
                  To replace the photograph on an existing report,
                  we will add a separate photo-update feature.
                </p>
              )}

              <button disabled={loading}>
                {loading
                  ? 'Submitting...'
                  : editingId
                    ? 'Update Report'
                    : 'Submit Report'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setReport(emptyReport);
                  resetPhoto();
                  setPage('dashboard');
                }}
              >
                Cancel
              </button>

            </form>

          </section>

        )}

        {/* CLAIM FORM */}

        {page === 'claim' && (

          <section className="form-container">

            <h2>Submit Ownership Claim</h2>

            <form onSubmit={submitClaim}>

              <input
                type="number"
                required
                placeholder="Item ID"
                value={claim.itemId}
                onChange={e => setClaim({
                  ...claim,
                  itemId: e.target.value
                })}
              />

              <textarea
                required
                minLength="10"
                placeholder="Explain how you can prove ownership..."
                value={claim.evidence}
                onChange={e => setClaim({
                  ...claim,
                  evidence: e.target.value
                })}
              />

              <button disabled={loading}>
                {loading ? 'Submitting...' : 'Submit Claim'}
              </button>

              <button
                type="button"
                onClick={() => setPage('home')}
              >
                Cancel
              </button>

            </form>

          </section>

        )}

        {/* STUDENT DASHBOARD */}

        {page === 'dashboard' && (

          <section className="content student-dashboard">

            <div className="dashboard-welcome">

              <h2>Welcome, {user?.full_name}</h2>

              <p>
                Manage your lost and found reports and track
                your ownership claims.
              </p>

              <p>Account type: {user?.role}</p>

              <div className="dashboard-actions">

                <button onClick={() => openReport('LOST')}>
                  Report Lost Item
                </button>

                <button onClick={() => openReport('FOUND')}>
                  Report Found Item
                </button>

              </div>

            </div>

            <div className="dashboard-stats">

              <div className="stat-card">
                <h3>{myReports.length}</h3>
                <p>Total Reports</p>
              </div>

              <div className="stat-card">
                <h3>
                  {myReports.filter(item =>
                    item.review_status === 'PENDING'
                  ).length}
                </h3>
                <p>Pending Reports</p>
              </div>

              <div className="stat-card">
                <h3>
                  {myReports.filter(item =>
                    item.review_status === 'APPROVED'
                  ).length}
                </h3>
                <p>Approved Reports</p>
              </div>

              <div className="stat-card">
                <h3>{myClaims.length}</h3>
                <p>Ownership Claims</p>
              </div>

            </div>

            {/* MY REPORTS */}

            <div className="dashboard-section">

              <h3>My Reports</h3>

              {myReports.length === 0 ? (

                <div className="empty-dashboard">
                  <p>You have not submitted any reports yet.</p>
                </div>

              ) : (

                myReports.map(item => (

                  <div className="dashboard-item" key={item.id}>

                    {item.photo_url && (
                      <img
                        className="dashboard-photo"
                        src={getPhotoUrl(item.photo_url)}
                        alt={item.title}
                      />
                    )}

                    <h4>{item.title}</h4>

                    <p>
                      <strong>Report type:</strong> {item.report_type}
                    </p>

                    <p>
                      <strong>Category:</strong> {item.category}
                    </p>

                    <p>
                      <strong>Location:</strong> {item.campus_location}
                    </p>

                    <p>
                      <strong>Review status:</strong> {item.review_status}
                    </p>

                    <p>
                      <strong>Item status:</strong> {item.status}
                    </p>

                    {item.admin_response && (
                      <p>
                        <strong>Administrator response:</strong>
                        {' '}{item.admin_response}
                      </p>
                    )}

                    {item.status === 'OPEN' &&
                      item.review_status !== 'REJECTED' && (
                        <button onClick={() => editReport(item)}>
                          Edit Report
                        </button>
                      )}

                  </div>

                ))

              )}

            </div>

            {/* MY CLAIMS */}

            <div className="dashboard-section">

              <h3>My Ownership Claims</h3>

              {myClaims.length === 0 ? (

                <div className="empty-dashboard">
                  You have not submitted any ownership claims.
                </div>

              ) : (

                myClaims.map(item => (

                  <div className="dashboard-item" key={item.id}>

                    <h4>Claim #{item.id}</h4>

                    <p>
                      <strong>Item:</strong>
                      {' '}{item.title || 'Reported item'}
                    </p>

                    <p>
                      <strong>Claim status:</strong> {item.status}
                    </p>

                    {item.admin_response && (
                      <p>
                        <strong>Administrator response:</strong>
                        {' '}{item.admin_response}
                      </p>
                    )}

                  </div>

                ))

              )}

            </div>

          </section>

        )}

        {/* ADMIN DASHBOARD */}

        {page === 'admin' && user?.role === 'ADMIN' && (
          <AdminDashboard headers={headers} />
        )}

      </main>

      <footer>
        <p>UCU Campus Lost and Found | 2026</p>
      </footer>

    </div>
  );
}



// ADMINISTRATOR DASHBOARD

function AdminDashboard({ headers }) {

  const [pending, setPending] = useState([]);
  const [claims, setClaims] = useState([]);
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);

  const [reportSearch, setReportSearch] = useState('');
  const [reportType, setReportType] = useState('ALL');
  const [reportStatus, setReportStatus] = useState('ALL');

  const [claimSearch, setClaimSearch] = useState('');
  const [claimStatus, setClaimStatus] = useState('ALL');

  async function loadAdminData() {
    try {
      setLoading(true);

      const [itemsResponse, claimsResponse] = await Promise.all([
        axios.get(`${API}/admin/items`, { headers }),
        axios.get(`${API}/admin/claims`, { headers })
      ]);

      setPending(getArray(itemsResponse.data, ['items']));
      setClaims(getArray(claimsResponse.data, ['claims']));

    } catch (error) {
      setNotice(
        error.response?.data?.message ||
        'Unable to load administrator information.'
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAdminData();
  }, []);

  async function reviewItem(id, decision) {

    let admin_response = '';

    if (decision === 'REJECTED') {
      admin_response = window.prompt('Enter the reason for rejection:');

      if (!admin_response?.trim()) return;
    } else {
      admin_response = 'Your item report has been approved.';
    }

    try {
      await axios.patch(
        `${API}/admin/items/${id}/review`,
        { decision, admin_response },
        { headers }
      );

      setNotice(`Report ${decision.toLowerCase()} successfully.`);
      await loadAdminData();

    } catch (error) {
      setNotice(
        error.response?.data?.message ||
        'Unable to review report.'
      );
    }
  }

  async function reviewClaim(id, decision) {

    const admin_response = window.prompt(
      'Enter an administrator response:'
    );

    if (decision === 'REJECTED' && !admin_response?.trim()) return;

    try {
      await axios.patch(
        `${API}/admin/claims/${id}/review`,
        { decision, admin_response: admin_response || '' },
        { headers }
      );

      setNotice(`Claim ${decision.toLowerCase()} successfully.`);
      await loadAdminData();

    } catch (error) {
      setNotice(
        error.response?.data?.message ||
        'Unable to review claim.'
      );
    }
  }

  async function markReturned(id) {

    if (!window.confirm(
      'Confirm that this item has actually been collected by its owner?'
    )) return;

    try {
      await axios.patch(
        `${API}/admin/items/${id}/returned`,
        { collection_confirmed: true },
        { headers }
      );

      setNotice('Item successfully marked as returned.');
      await loadAdminData();

    } catch (error) {
      setNotice(
        error.response?.data?.message ||
        'Unable to update item status.'
      );
    }
  }

  // SEARCH AND FILTER REPORTS

  const filteredReports = pending.filter(item => {

    const searchText = [
      item.title,
      item.category,
      item.description,
      item.campus_location,
      item.full_name,
      item.email
    ].join(' ').toLowerCase();

    const matchesSearch = searchText.includes(
      reportSearch.toLowerCase()
    );

    const matchesType =
      reportType === 'ALL' || item.report_type === reportType;

    const matchesStatus =
      reportStatus === 'ALL' ||
      item.review_status === reportStatus;

    return matchesSearch && matchesType && matchesStatus;
  });

  // SEARCH AND FILTER CLAIMS

  const filteredClaims = claims.filter(claim => {

    const searchText = [
      claim.title,
      claim.full_name,
      claim.email,
      claim.evidence,
      claim.id
    ].join(' ').toLowerCase();

    const matchesSearch = searchText.includes(
      claimSearch.toLowerCase()
    );

    const matchesStatus =
      claimStatus === 'ALL' || claim.status === claimStatus;

    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <section className="content">
        <h2>Administrator Dashboard</h2>
        <p>Loading dashboard...</p>
      </section>
    );
  }

  return (

    <section className="content admin-dashboard">

      <div className="dashboard-welcome">

        <h2>Administrator Dashboard</h2>

        <p>
          Manage lost and found reports and ownership claims.
        </p>

        <button onClick={loadAdminData}>
          Refresh Dashboard
        </button>

      </div>

      {notice && (
        <div className="message" role="status">
          {notice}
          <button onClick={() => setNotice('')}>×</button>
        </div>
      )}

      {/* STATISTICS */}

      <div className="dashboard-stats">

        <div className="stat-card">
          <h3>{pending.length}</h3>
          <p>Total Reports</p>
        </div>

        <div className="stat-card">
          <h3>
            {pending.filter(item =>
              item.review_status === 'PENDING'
            ).length}
          </h3>
          <p>Pending Reports</p>
        </div>

        <div className="stat-card">
          <h3>
            {pending.filter(item =>
              item.review_status === 'APPROVED'
            ).length}
          </h3>
          <p>Approved Reports</p>
        </div>

        <div className="stat-card">
          <h3>{claims.length}</h3>
          <p>Ownership Claims</p>
        </div>

      </div>

      {/* REPORT SEARCH AND FILTERS */}

      <div className="dashboard-section">

        <h3>Manage Item Reports</h3>

        <div className="search-area">

          <input
            type="search"
            placeholder="Search item, category, location or student..."
            value={reportSearch}
            onChange={e => setReportSearch(e.target.value)}
          />

          <select
            value={reportType}
            onChange={e => setReportType(e.target.value)}
          >
            <option value="ALL">All Report Types</option>
            <option value="LOST">Lost Items</option>
            <option value="FOUND">Found Items</option>
          </select>

          <select
            value={reportStatus}
            onChange={e => setReportStatus(e.target.value)}
          >
            <option value="ALL">All Report Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>

        </div>

        <p>
          Showing {filteredReports.length} of {pending.length} reports
        </p>

        {filteredReports.length === 0 ? (

          <div className="empty-dashboard">
            No matching reports found.
          </div>

        ) : (

          <div className="grid">

            {filteredReports.map(item => (

              <div className="dashboard-item" key={item.id}>

                {item.photo_url && (
                  <img
                    className="dashboard-photo"
                    src={getPhotoUrl(item.photo_url)}
                    alt={item.title}
                  />
                )}

                <h4>{item.title}</h4>

                <p>
                  <strong>Report type:</strong> {item.report_type}
                </p>

                <p>
                  <strong>Category:</strong> {item.category}
                </p>

                <p>
                  <strong>Location:</strong> {item.campus_location}
                </p>

                <p>
                  <strong>Description:</strong> {item.description}
                </p>

                <p>
                  <strong>Review status:</strong> {item.review_status}
                </p>

                {item.review_status === 'PENDING' && (

                  <div className="dashboard-actions">

                    <button
                      onClick={() => reviewItem(item.id, 'APPROVED')}
                    >
                      Approve
                    </button>

                    <button
                      className="danger"
                      onClick={() => reviewItem(item.id, 'REJECTED')}
                    >
                      Reject
                    </button>

                  </div>

                )}

              </div>

            ))}

          </div>

        )}

      </div>

      {/* CLAIM SEARCH AND FILTERS */}

      <div className="dashboard-section">

        <h3>Manage Ownership Claims</h3>

        <div className="search-area">

          <input
            type="search"
            placeholder="Search by claimant, item or evidence..."
            value={claimSearch}
            onChange={e => setClaimSearch(e.target.value)}
          />

          <select
            value={claimStatus}
            onChange={e => setClaimStatus(e.target.value)}
          >
            <option value="ALL">All Claim Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>

        </div>

        <p>
          Showing {filteredClaims.length} of {claims.length} claims
        </p>

        {filteredClaims.length === 0 ? (

          <div className="empty-dashboard">
            No matching ownership claims found.
          </div>

        ) : (

          <div className="grid">

            {filteredClaims.map(claim => (

              <div className="dashboard-item" key={claim.id}>

                <h4>Ownership Claim #{claim.id}</h4>

                <p>
                  <strong>Item:</strong>
                  {' '}{claim.title || 'Reported item'}
                </p>

                <p>
                  <strong>Claimant:</strong>
                  {' '}{claim.full_name || claim.email || 'Not available'}
                </p>

                <p>
                  <strong>Evidence:</strong> {claim.evidence}
                </p>

                <p>
                  <strong>Claim status:</strong> {claim.status}
                </p>

                {claim.status === 'PENDING' && (

                  <div className="dashboard-actions">

                    <button
                      onClick={() => reviewClaim(claim.id, 'APPROVED')}
                    >
                      Approve Claim
                    </button>

                    <button
                      className="danger"
                      onClick={() => reviewClaim(claim.id, 'REJECTED')}
                    >
                      Reject Claim
                    </button>

                  </div>

                )}

                {claim.status === 'APPROVED' && claim.item_id && (

                  <button
                    onClick={() => markReturned(claim.item_id)}
                  >
                    Confirm Item Returned
                  </button>

                )}

              </div>

            ))}

          </div>

        )}

      </div>

    </section>

  );
}

export default App;
