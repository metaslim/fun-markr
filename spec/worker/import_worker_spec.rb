require 'spec_helper'
require 'sidekiq/testing'
require 'sidekiq-status/testing/inline'

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

  let(:repository) { instance_double(Markr::Repository::TestResultRepository) }
  let(:aggregate_repository) { instance_double(Markr::Repository::AggregateRepository) }
  let(:mock_db) { double('database') }

  before do
    allow(described_class).to receive(:repository).and_return(repository)
    allow(described_class).to receive(:aggregate_repository).and_return(aggregate_repository)
    allow(described_class).to receive(:database).and_return(mock_db)
    allow(mock_db).to receive(:transaction).and_yield
    allow(mock_db).to receive(:database_type).and_return(:sqlite)
    allow(repository).to receive(:bulk_save)
    allow(repository).to receive(:scores_for_test).and_return([65.0])
    allow(aggregate_repository).to receive(:save)
  end

  describe '#perform' do
    subject(:worker) { described_class.new }

    it 'parses XML and bulk saves results' do
      expect(repository).to receive(:bulk_save).with(
        array_including(
          an_object_having_attributes(
            student_number: '002299',
            test_id: '9863',
            marks_available: 20,
            marks_obtained: 13
          )
        )
      )

      worker.perform(valid_xml, 'text/xml+markr')
    end

    it 'computes and saves aggregates' do
      expect(aggregate_repository).to receive(:save).with('9863', hash_including('mean', 'count'))

      worker.perform(valid_xml, 'text/xml+markr')
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

      expect(repository).to receive(:bulk_save).with(
        array_including(
          an_object_having_attributes(student_number: '001'),
          an_object_having_attributes(student_number: '002')
        )
      )

      worker.perform(xml, 'text/xml+markr')
    end

    it 'computes aggregates for each unique test_id' do
      xml = <<~XML
        <mcq-test-results>
          <mcq-test-result>
            <student-number>001</student-number>
            <test-id>1001</test-id>
            <summary-marks available="20" obtained="15" />
          </mcq-test-result>
          <mcq-test-result>
            <student-number>002</student-number>
            <test-id>1002</test-id>
            <summary-marks available="20" obtained="18" />
          </mcq-test-result>
        </mcq-test-results>
      XML

      expect(repository).to receive(:scores_for_test).with('1001').and_return([75.0])
      expect(repository).to receive(:scores_for_test).with('1002').and_return([90.0])
      expect(aggregate_repository).to receive(:save).with('1001', hash_including('mean'))
      expect(aggregate_repository).to receive(:save).with('1002', hash_including('mean'))

      worker.perform(xml, 'text/xml+markr')
    end

    it 'skips aggregate when no scores exist' do
      allow(repository).to receive(:scores_for_test).and_return([])

      expect(aggregate_repository).not_to receive(:save)

      worker.perform(valid_xml, 'text/xml+markr')
    end

    it 'raises error for invalid content type' do
      expect {
        worker.perform('{}', 'application/json')
      }.to raise_error(Markr::Loader::UnsupportedContentTypeError)
    end

    it 'raises error for invalid XML' do
      expect {
        worker.perform('<invalid>', 'text/xml+markr')
      }.to raise_error(Nokogiri::XML::SyntaxError)
    end

    it 'uses advisory lock for postgres' do
      allow(mock_db).to receive(:database_type).and_return(:postgres)
      expect(mock_db).to receive(:run).with(/pg_advisory_xact_lock/)

      worker.perform(valid_xml, 'text/xml+markr')
    end

    it 'skips advisory lock for sqlite' do
      allow(mock_db).to receive(:database_type).and_return(:sqlite)
      expect(mock_db).not_to receive(:run)

      worker.perform(valid_xml, 'text/xml+markr')
    end
  end

  describe '.perform_async' do
    before { Sidekiq::Testing.fake! }
    after { Sidekiq::Worker.clear_all }

    it 'enqueues job' do
      expect {
        described_class.perform_async(valid_xml, 'text/xml+markr')
      }.to change(described_class.jobs, :size).by(1)
    end

    it 'stores correct arguments in the job' do
      described_class.perform_async(valid_xml, 'text/xml+markr')
      job = described_class.jobs.last
      expect(job['args']).to eq([valid_xml, 'text/xml+markr'])
    end
  end
end
