require 'spec_helper'
require 'sequel'
require 'sidekiq/testing'

RSpec.describe Markr::Worker::ImportWorker do
  let(:valid_xml) do
    <<~XML
      <mcq-test-results>
        <mcq-test-result scanned-on="2017-12-04T12:12:10+11:00">
          <first-name>KJ</first-name>
          <last-name>Alysander</last-name>
          <student-number>002299</student-number>
          <test-id>9863</test-id>
          <summary-marks available="20" obtained="13" />
        </mcq-test-result>
      </mcq-test-results>
    XML
  end

  let(:db) { Sequel.sqlite }
  let(:repository) { Markr::Repository::TestResultRepository.new(db) }

  before do
    Sidekiq::Testing.fake!

    db.create_table(:test_results) do
      primary_key :id
      String :student_number, null: false
      String :test_id, null: false
      Integer :marks_available, null: false
      Integer :marks_obtained, null: false
      String :scanned_on
      DateTime :created_at
      DateTime :updated_at
      unique [:student_number, :test_id]
    end

    # Inject test repository
    allow(described_class).to receive(:repository).and_return(repository)
  end

  after do
    Sidekiq::Worker.clear_all
    db.drop_table(:test_results)
  end

  describe '.perform_async' do
    it 'enqueues job' do
      expect {
        described_class.perform_async(valid_xml, 'text/xml+markr')
      }.to change(described_class.jobs, :size).by(1)
    end
  end

  describe '#perform' do
    it 'parses XML and saves results' do
      Sidekiq::Testing.inline! do
        described_class.perform_async(valid_xml, 'text/xml+markr')
      end

      expect(db[:test_results].count).to eq(1)
      result = db[:test_results].first
      expect(result[:student_number]).to eq('002299')
      expect(result[:marks_obtained]).to eq(13)
    end

    it 'handles multiple results' do
      xml = <<~XML
        <mcq-test-results>
          <mcq-test-result>
            <student-number>001</student-number>
            <test-id>9863</test-id>
            <summary-marks available="20" obtained="15" />
          </mcq-test-result>
          <mcq-test-result>
            <student-number>002</student-number>
            <test-id>9863</test-id>
            <summary-marks available="20" obtained="18" />
          </mcq-test-result>
        </mcq-test-results>
      XML

      Sidekiq::Testing.inline! do
        described_class.perform_async(xml, 'text/xml+markr')
      end

      expect(db[:test_results].count).to eq(2)
    end

    it 'raises error for invalid content type' do
      expect {
        Sidekiq::Testing.inline! do
          described_class.perform_async('{}', 'application/json')
        end
      }.to raise_error(Markr::Loader::UnsupportedContentTypeError)
    end

    it 'raises error for invalid XML' do
      expect {
        Sidekiq::Testing.inline! do
          described_class.perform_async('<invalid>', 'text/xml+markr')
        end
      }.to raise_error(Nokogiri::XML::SyntaxError)
    end
  end
end
