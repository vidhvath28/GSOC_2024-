import React from 'react';
import { BrowserRouter as Router, Route, Routes, Link } from 'react-router-dom';
import './App.css';  // Include styles directly

function Header() {
  return (
    <header className="header">
      <h1>Crystal2Nix Documentation</h1>
      <nav className="navbar">
        <Link to="/">Home</Link>
        <Link to="/objectives">Objectives</Link>
        <Link to="/features">Features</Link>
        <Link to="/technical-details">Technical Details</Link>
        <Link to="/usage">Usage</Link>
        <Link to="/testing">Testing</Link>
        <Link to="/future-work">Future Work</Link>
        <Link to="/acknowledgments">Acknowledgments</Link>
      </nav>
    </header>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <p>© 2024 Vidhvath - Crystal2Nix Project</p>
    </footer>
  );
}

function Home() {
  return (
    <div>
      <h2>Introduction</h2>
      <p>
        <strong>Crystal2Nix</strong> is a tool designed to integrate the Crystal programming language with Nix package management, enabling seamless management of Crystal dependencies and builds within the Nix ecosystem. This project was developed as part of the Google Summer of Code (GSoC) 2024.
      </p>
      <p>
        <strong>Crystal2Nix</strong> aims to bridge the gap between Crystal and Nix by providing a robust mechanism for managing Crystal dependencies, building Crystal projects, and ensuring reproducibility. It handles various repository types and integrates with Nix's powerful build and package management system.
      </p>
    </div>
  );
}

function Objectives() {
  return (
    <div>
      <h2>Objectives</h2>
      <ul>
        <li>Integrate Crystal with Nix: Facilitate the use of Crystal projects within Nix-based environments.</li>
        <li>Support Multiple Repository Types: Handle Git and  Mercurial repositories.</li>
        <li>Enhance Build and Test Processes: Streamline the build and testing of Crystal projects within Nix.</li>
      </ul>
    </div>
  );
}

function Features() {
  return (
    <div>
      <h2>Features and Achievements</h2>
      <h3>Key Features</h3>
      <ul>
        <li>Repository Support: Integration with Git and  Mercurial repositories.</li>
        <li>Nix Integration: Ability to fetch and manage dependencies using <code>nix-prefetch-* </code> commands.</li>
        <li>Testing Framework: Implementation of a testing framework using Crystal's <code>spec</code> and Spectator for integration and unit tests.</li>
        <li>Automated Dependency Management: Automatic fetching and handling of dependencies based on <code>shard.lock</code> and <code>shard.yml</code> files.</li>
      </ul>
      <h3>Major Milestones</h3>
      <ul>
        <li>Repository Integration: Successfully integrated support for Git and  Mercurial repositories.</li>
        <li>Enhanced Prefetching: Implemented <code>nix-prefetch-git</code>, <code>nix-prefetch-hg</code> for efficient fetching of repository data.</li>
        <li>Testing Framework Setup: Established a comprehensive testing setup with <code>spectator</code> and custom test cases.</li>
      </ul>
    </div>
  );
}

function TechnicalDetails() {
  return (
    <div>
      <h2>Technical Details</h2>
      <h3>Architecture</h3>
      <p>
        <strong>Crystal2Nix</strong> consists of several key components:
      </p>
      <ul>
        <li><strong>Repo Class:</strong> Manages repository details and handles different repository types.</li>
        <li><strong>Worker Class:</strong> Responsible for processing <code>shard.lock</code> files, fetching repository data, and writing to <code>shards.nix</code>.</li>
        <li><strong>Support for Multiple Repositories:</strong> Handles Git and  Mercurial repositories through respective <code>nix-prefetch </code> commands.</li>
      </ul>
      <h3>Implementation Details</h3>
      <pre className="code-block">
{`// Data.cr
module Crystal2Nix
  class GitPrefetchJSON
    include JSON::Serializable

    property sha256 : String
  end

  class ShardLock
    include YAML::Serializable

    property version : Float32
    property shards : Hash(String, Shard)
  end

  class Shard
    include YAML::Serializable

    property git : String?
    property hg : String?
    property fossil : String?
    property version : String
  end
end

`}
{`// Repo.cr
module Crystal2Nix
  class Repo
    @url : URI
    getter rev : String
    getter type : Symbol

    def initialize(entry : Shard)
      git_url = entry.git.try(&.not_nil!) # Safely access entry.git
      hg_url = entry.hg.try(&.not_nil!)   # Safely access entry.hg
      fossil_url = entry.fossil.try(&.not_nil!) # Safely access entry.fossil


      if git_url
        @url = URI.parse(git_url)
        @type = :git
      elsif hg_url
        @url = URI.parse(hg_url)
        @type = :hg
      elsif fossil_url
        @url = URI.parse(fossil_url)
        @type = :fossil
      else
        raise "Unknown repository type"
      end

      @rev = if entry.version =~ /(?<version>.+)\+(git|hg|fossil)\.commit\.(?<rev>.+)/
               $~["rev"]
             else
               "v#{entry.version}"
             end
    end

    def url : String
      @url.to_s
    end
  end
end
`}
{`// worker.cr
module Crystal2Nix
  SHARDS_NIX = "shards.nix"

  class Worker
    def initialize(@lock_file : String)
    end

    def run
      File.open SHARDS_NIX, "w+" do |file|
        file.puts %({)
        ShardLock.from_yaml(File.read(@lock_file)).shards.each do |key, value|
          repo = Repo.new value
          if repo.nil?
            STDERR.puts "Unable to parse repository entry"
            exit 1
          end

          hash = ""

          case repo.type
          when :git
            args = [
              "--url", repo.url,
              "--rev", repo.rev,
            ]
            Process.run("nix-prefetch-git", args: args) do |process|
              process.error.each_line { |e| STDERR.puts e }
              hash = GitPrefetchJSON.from_json(process.output.gets_to_end).sha256
            end

          when :hg
            args = [
              repo.url,
              repo.rev,
            ]
            Process.run("nix-prefetch-hg", args: args) do |process|
              process.error.each_line { |e| STDERR.puts e }
              output = process.output.gets_to_end
              hash = output.strip.split("\n").first
              if hash.nil? || hash.empty?
                STDERR.puts "Failed to fetch hash for hg repository: #{repo.url}"
                hash = "hash not found"
              end
            end

          when :fossil
            args = [
              "--url", repo.url,
              "--rev", repo.rev,
            ]
            Process.run("nix-prefetch-url", args: args) do |process|
              process.error.each_line { |e| STDERR.puts e }
              hash = process.output.gets_to_end.strip
              if hash.nil? || hash.empty?
                STDERR.puts "Failed to fetch hash for fossil repository: #{repo.url}"
                hash = "hash not found"
              end
            end

          else
            STDERR.puts "Unknown repository type: #{repo.type}"
            hash = "hash not found"
          end

          file.puts %(  #{key} = {)
          file.puts %(    url = "#{repo.url}";)
          file.puts %(    rev = "#{repo.rev}";)
          file.puts %(    hash = "#{hash}";)
          file.puts %(  };)
        end
        file.puts %(})
      end
    end
  end
end
`}
      </pre>
      <h3>Challenges and Solutions</h3>
      <ul>
        <li><strong>Repository Fetching Issues:</strong> Faced challenges with fetching data from various repository types. Resolved by implementing appropriate <code>nix-prefetch </code> commands and handling errors gracefully.</li>
        <li><strong>Error Handling:</strong> Improved error handling for cases where repository types were unknown or data could not be fetched.</li>
      </ul>
    </div>
  );
}

function Usage() {
  return (
    <div>
      <h2>Usage Instructions</h2>
      <h3>Installation and Setup</h3>
      <ol>
        <li>Clone the Repository:
          <pre className="code-block">git clone https://github.com/nix-community/crystal2nix</pre>
        </li>
        <li>Install Shards:
          <pre className="code-block">shards install</pre>
        </li>
        <li>Build the Project:
          <pre className="code-block">crystal build src/crystal2nix.cr</pre>
        </li>
      </ol>
      <h3>Run the Worker</h3>
      <pre className="code-block">crystal run src/worker.cr</pre>
      <h3>Check Output</h3>
      <p>The <code>shards.nix</code> file will be generated with all repository details and hashes.</p>
    </div>
  );
}

function Testing() {
  return (
    <div>
      <h2>Testing and Validation</h2>
      <h3>Testing Process</h3>
      <ul>
        <li><strong>Unit Tests:</strong> Implemented unit tests using Crystal's <code>spec</code> framework.</li>
        <li><strong>Integration Tests:</strong> Created integration tests to ensure end-to-end functionality.</li>
      </ul>
      <h3>Results</h3>
      <ul>
        <li><strong>Successful Testing:</strong> All tests passed successfully, verifying the correctness of repository handling and data fetching.</li>
        <li><strong>Bug Fixes:</strong> Addressed issues related to repository fetching and hash computation.</li>
      </ul>
    </div>
  );
}

function FutureWork() {
  return (
    <div>
      <h2>Future Work</h2>
      <ul>
        <li><strong>Enhanced Repository Support:</strong> Add support for additional repository types if needed.</li>
        <li><strong>Performance Improvements:</strong> Optimize fetching and processing of large repositories.</li>
        <li><strong>User Documentation:</strong> Improve user documentation and examples for easier adoption.</li>
      </ul>
    </div>
  );
}

function Acknowledgments() {
  return (
    <div>
      <h2>Acknowledgments</h2>
      <ul>
        <li>
          <strong>Mentor:</strong> Peter Hoeg
          <div style={{ display: 'flex', alignItems: 'center', marginTop: '10px' }}>
            <img
              src="https://avatars.githubusercontent.com/u/722550?v=4"  // Update the path to where the image is stored
              alt="Peter Hoeg"
              style={{
                width: '200px',
                borderRadius: '8px',
                marginRight: '15px',
                // Optional: add a box shadow for better visual separation
                boxShadow: '0px 4px 6px rgba(0, 0, 0, 0.1)',
              }}
            />
            <div>
              <p>
                I would like to extend my deepest gratitude to Peter Hoeg, whose invaluable mentorship and support have been instrumental throughout this project. Peter’s extensive knowledge and experience in both the Crystal and Nix ecosystems provided a solid foundation for the development of Crystal2Nix. His ability to offer clear, strategic guidance was crucial in addressing complex technical challenges and refining our approach.
              </p>
              <p>
                Peter played a key role in shaping the project’s direction and ensuring that it met its objectives. His insightful feedback and thoughtful suggestions significantly enhanced the project's quality and functionality. Beyond his technical expertise, Peter's enthusiasm and commitment to mentoring were a great source of motivation throughout the development process. His support has been a major factor in the successful completion of this project.
              </p>
            </div>
          </div>
        </li>
        
         
      </ul>
    </div>
  );
}


function App() {
  return (
    <div className="App">
      <Router>
        <Header />
        <div className="container">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/objectives" element={<Objectives />} />
            <Route path="/features" element={<Features />} />
            <Route path="/technical-details" element={<TechnicalDetails />} />
            <Route path="/usage" element={<Usage />} />
            <Route path="/testing" element={<Testing />} />
            <Route path="/future-work" element={<FutureWork />} />
            <Route path="/acknowledgments" element={<Acknowledgments />} />
          </Routes>
        </div>
        <Footer />
      </Router>
    </div>
  );
}

export default App;
